import { getCruzeiroPool } from '@/lib/cruzeiro-db';
import { upsertAlunosCep } from '@/lib/supabase-server';
import { listAlunosSnapshot } from './alunos-cep-sync';
import { chaveLocal, geocodeAlunoLocal, isLocalValido, isRuaValida } from './geo-local';
import { LATEST_MATRICULADOS } from './queries';

function log(message: string) {
  console.log(`[alunos-cep] ${new Date().toISOString()} ${message}`);
}

export async function backfillAlunosCep() {
  const db = getCruzeiroPool();
  const snapshot = await db.query<{ id: number; uploaded_at: Date }>(LATEST_MATRICULADOS);
  const current = snapshot.rows[0];
  if (!current) throw new Error('Nenhum snapshot de matriculados.');

  const alunos = await listAlunosSnapshot(current.id);
  const grupos = new Map<
    string,
    {
      cidade: string;
      bairro: string;
      endereco: string;
      alunos: Array<{ rgm: string; telefone: string; bairro: string }>;
    }
  >();

  for (const aluno of alunos.values()) {
    if (!isRuaValida(aluno.endereco) && !isLocalValido(aluno.cidade, aluno.bairro)) continue;
    const key = chaveLocal(aluno.cidade, aluno.bairro, aluno.endereco);
    const grupo = grupos.get(key) || {
      cidade: aluno.cidade,
      bairro: aluno.bairro,
      endereco: aluno.endereco,
      alunos: [],
    };
    grupo.alunos.push({ rgm: aluno.rgm, telefone: aluno.telefone, bairro: aluno.bairro });
    grupos.set(key, grupo);
  }

  const keys = [...grupos.keys()];
  if (keys.length) {
    await db.query(
      `
      INSERT INTO ativacao_locais (local_key, cidade, bairro)
      SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])
      ON CONFLICT (local_key) DO NOTHING
      `,
      [keys, keys.map((key) => grupos.get(key)!.cidade), keys.map((key) => grupos.get(key)!.bairro)]
    );
  }

  log(`snapshot ${current.id}: ${alunos.size} telefones, ${grupos.size} ruas/bairros`);

  let processados = 0;
  for (;;) {
    const pendente = await db.query<{ local_key: string; cidade: string; bairro: string }>(
      `
      SELECT local_key, cidade, bairro
      FROM ativacao_locais
      WHERE lat IS NULL AND tentativas < 3
        AND local_key = ANY($1::text[])
      ORDER BY local_key
      LIMIT 1
      `,
      [keys]
    );
    const local = pendente.rows[0];
    if (!local) break;

    const grupo = grupos.get(local.local_key);
    const geo = await geocodeAlunoLocal(local.cidade, grupo?.bairro || local.bairro, grupo?.endereco);
    await db.query(
      `
      UPDATE ativacao_locais
      SET cep = $2, lat = $3, lng = $4, geocoded_at = NOW(), tentativas = tentativas + 1
      WHERE local_key = $1
      `,
      [local.local_key, geo?.cep ?? null, geo?.lat ?? null, geo?.lng ?? null]
    );

    if (grupo?.alunos.length) {
      await upsertAlunosCep(
        grupo.alunos.map((aluno) => ({
          rgm: aluno.rgm,
          telefone: aluno.telefone,
          cep: geo?.cep ?? null,
          bairro: aluno.bairro || null,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
        }))
      );
    }

    processados += 1;
    if (processados % 10 === 0) {
      const left = await db.query<{ n: string }>(
        `
        SELECT COUNT(*)::int AS n
        FROM ativacao_locais
        WHERE lat IS NULL AND tentativas < 3 AND local_key = ANY($1::text[])
        `,
        [keys]
      );
      log(`geocodificados ${processados} · pendentes ${left.rows[0]?.n} · ultimo ${local.cidade} / ${grupo?.endereco || local.bairro} · cep ${geo?.cep || '-'}`);
    }
  }

  const coords = await db.query<{ local_key: string; cep: string | null; lat: number | null; lng: number | null }>(
    'SELECT local_key, cep, lat, lng FROM ativacao_locais WHERE local_key = ANY($1::text[])',
    [keys]
  );
  const byKey = new Map(coords.rows.map((row) => [row.local_key, row]));
  const rows = [...alunos.values()].map((aluno) => {
    const key = chaveLocal(aluno.cidade, aluno.bairro, aluno.endereco);
    const geo = byKey.get(key);
    return {
      rgm: aluno.rgm,
      telefone: aluno.telefone,
      cep: geo?.cep ?? null,
      bairro: aluno.bairro || null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
    };
  });

  const pageSize = 400;
  for (let i = 0; i < rows.length; i += pageSize) {
    await upsertAlunosCep(rows.slice(i, i + pageSize));
  }

  await db.query(
    `
    INSERT INTO ativacao_geo_sync (id, snapshot_id, snapshot_uploaded_at, ran_at)
    VALUES (1, $1, $2, NOW())
    ON CONFLICT (id) DO UPDATE
      SET snapshot_id = EXCLUDED.snapshot_id,
          snapshot_uploaded_at = EXCLUDED.snapshot_uploaded_at,
          ran_at = EXCLUDED.ran_at
    `,
    [current.id, current.uploaded_at]
  );

  const ok = coords.rows.filter((row) => row.lat != null).length;
  log(`concluido: ${rows.length} alunos na alunos_cep, ${ok}/${grupos.size} ruas com coordenada`);
}
