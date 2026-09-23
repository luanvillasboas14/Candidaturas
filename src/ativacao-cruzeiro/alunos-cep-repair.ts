import { getCruzeiroPool } from '@/lib/cruzeiro-db';
import { upsertAlunosCep } from '@/lib/supabase-server';
import { chaveLocal, geocodeAlunoLocal, isRuaValida } from './geo-local';
import { listAlunosSnapshot } from './alunos-cep-sync';
import { LATEST_MATRICULADOS } from './queries';

export type RuaGrupo = {
  cidade: string;
  bairro: string;
  endereco: string;
  alunos: Array<{ rgm: string; telefone: string; bairro: string }>;
};

export async function carregarGruposRua(): Promise<Map<string, RuaGrupo>> {
  const db = getCruzeiroPool();
  const snapshot = await db.query<{ id: number }>(LATEST_MATRICULADOS);
  const current = snapshot.rows[0];
  const grupos = new Map<string, RuaGrupo>();
  if (!current) return grupos;

  const alunos = await listAlunosSnapshot(current.id);
  for (const aluno of alunos.values()) {
    if (!isRuaValida(aluno.endereco)) continue;
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
  return grupos;
}

export async function ruasPendentes(grupos: Map<string, RuaGrupo>): Promise<string[]> {
  const keys = [...grupos.keys()];
  if (!keys.length) return [];
  const db = getCruzeiroPool();
  const prontos = await db.query<{ local_key: string }>(
    `
    SELECT local_key
    FROM ativacao_locais
    WHERE local_key = ANY($1::text[]) AND lat IS NOT NULL
    `,
    [keys]
  );
  const jaTem = new Set(prontos.rows.map((row) => row.local_key));
  return keys.filter((key) => !jaTem.has(key));
}

async function gravarRua(key: string, grupo: RuaGrupo): Promise<number> {
  const db = getCruzeiroPool();
  const geo = await geocodeAlunoLocal(grupo.cidade, grupo.bairro, grupo.endereco);
  await db.query(
    `
    INSERT INTO ativacao_locais (local_key, cidade, bairro, cep, lat, lng, geocoded_at, tentativas)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1)
    ON CONFLICT (local_key) DO UPDATE
      SET cep = COALESCE(EXCLUDED.cep, ativacao_locais.cep),
          lat = COALESCE(EXCLUDED.lat, ativacao_locais.lat),
          lng = COALESCE(EXCLUDED.lng, ativacao_locais.lng),
          geocoded_at = NOW(),
          tentativas = ativacao_locais.tentativas + 1
    `,
    [key, grupo.cidade, grupo.bairro, geo?.cep ?? null, geo?.lat ?? null, geo?.lng ?? null]
  );
  if (!geo) return 0;
  await upsertAlunosCep(
    grupo.alunos.map((aluno) => ({
      rgm: aluno.rgm,
      telefone: aluno.telefone,
      cep: geo.cep,
      bairro: aluno.bairro || null,
      lat: geo.lat,
      lng: geo.lng,
    }))
  );
  return grupo.alunos.length;
}

export async function processarRuas(
  grupos: Map<string, RuaGrupo>,
  keys: string[],
  concurrency = 3
): Promise<{ ruas: number; atualizados: number }> {
  let atualizados = 0;
  let feitos = 0;
  let cursor = 0;
  const workers = Math.min(Math.max(1, concurrency), keys.length || 1);

  async function worker() {
    while (cursor < keys.length) {
      const index = cursor;
      cursor += 1;
      const key = keys[index];
      const grupo = grupos.get(key);
      if (!grupo) continue;
      try {
        atualizados += await gravarRua(key, grupo);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[cep-rua] falhou ${grupo.endereco} (${message}); nova tentativa em 20s`);
        await new Promise((resolve) => setTimeout(resolve, 20_000));
        try {
          atualizados += await gravarRua(key, grupo);
        } catch (retryError) {
          const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
          console.warn(`[cep-rua] pulou ${grupo.endereco} (${retryMessage})`);
        }
      }
      feitos += 1;
      if (feitos % 25 === 0 || feitos === keys.length) {
        console.log(`[cep-rua] ${feitos}/${keys.length} · ${grupo.endereco} · alunos=${atualizados}`);
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { ruas: keys.length, atualizados };
}

export async function repararAlunosCepPorRua(limite = 20): Promise<{
  ruas: number;
  atualizados: number;
}> {
  const grupos = await carregarGruposRua();
  const fila = (await ruasPendentes(grupos)).slice(0, Math.max(1, limite));
  if (!fila.length) return { ruas: 0, atualizados: 0 };
  return processarRuas(grupos, fila, 3);
}

export async function repararAlunosCepColapsados(limite = 30): Promise<{
  bairros: number;
  atualizados: number;
}> {
  const result = await repararAlunosCepPorRua(limite);
  return { bairros: result.ruas, atualizados: result.atualizados };
}
