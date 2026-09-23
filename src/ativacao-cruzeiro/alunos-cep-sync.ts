import { getCruzeiroPool } from '@/lib/cruzeiro-db';
import { normalizePhone } from '@/lib/phone';
import {
  countAlunosCep,
  deleteAlunosCepByTelefones,
  listAlunosCepTelefones,
  upsertAlunosCep,
  type AlunoCepRow,
} from '@/lib/supabase-server';
import { chaveLocal, geocodeAlunoLocal, isLocalValido, isRuaValida } from './geo-local';
import { LATEST_MATRICULADOS, LINHA_VALIDA } from './queries';

export type AlunosCepSyncStatus = {
  snapshotId: number | null;
  snapshotUploadedAt: string | null;
  lastSyncAt: string | null;
  lastSyncSnapshotId: number | null;
  alunos: number;
  precisaSincronizar: boolean;
};

export type AlunosCepSyncResult = AlunosCepSyncStatus & {
  alunosNovos: number;
  alunosRemovidos: number;
  inicializado: boolean;
};

export type AlunoSnapshot = {
  rgm: string;
  telefone: string;
  cidade: string;
  bairro: string;
  endereco: string;
};

async function markSync(snapshotId: number, uploadedAt: Date) {
  const db = getCruzeiroPool();
  await db.query(
    `
    INSERT INTO ativacao_geo_sync (id, snapshot_id, snapshot_uploaded_at, ran_at)
    VALUES (1, $1, $2, NOW())
    ON CONFLICT (id) DO UPDATE
      SET snapshot_id = EXCLUDED.snapshot_id,
          snapshot_uploaded_at = EXCLUDED.snapshot_uploaded_at,
          ran_at = EXCLUDED.ran_at
    `,
    [snapshotId, uploadedAt]
  );
}

export async function listAlunosSnapshot(snapshotId: number): Promise<Map<string, AlunoSnapshot>> {
  const db = getCruzeiroPool();
  const result = await db.query<{
    rgm: string | null;
    fone_cel: string | null;
    phones_digits: string | null;
    cidade: string | null;
    bairro: string | null;
    endereco: string | null;
  }>(
    `
    SELECT
      NULLIF(TRIM(r.data->>'rgm_digits'), '') AS rgm,
      NULLIF(TRIM(r.data->>'fone_cel'), '') AS fone_cel,
      NULLIF(TRIM(r.data->>'phones_digits'), '') AS phones_digits,
      COALESCE(NULLIF(TRIM(r.data->>'cidade'), ''), '') AS cidade,
      COALESCE(NULLIF(TRIM(r.data->>'bairro'), ''), '') AS bairro,
      COALESCE(
        NULLIF(TRIM(r.data->>'endereço'), ''),
        NULLIF(TRIM(r.data->>'endereco'), ''),
        ''
      ) AS endereco
    FROM xl_rows r
    WHERE r.snapshot_id = $1
      AND ${LINHA_VALIDA}
    `,
    [snapshotId]
  );

  const byPhone = new Map<string, AlunoSnapshot>();
  for (const row of result.rows) {
    if (!row.rgm) continue;
    const telefone = normalizePhone(row.phones_digits || row.fone_cel || '');
    if (!telefone) continue;
    if (byPhone.has(telefone)) continue;
    byPhone.set(telefone, {
      rgm: row.rgm,
      telefone,
      cidade: row.cidade || '',
      bairro: row.bairro || '',
      endereco: row.endereco || '',
    });
  }
  return byPhone;
}

async function resolverLocal(cidade: string, bairro: string, endereco: string) {
  const key = chaveLocal(cidade, bairro, endereco);
  const db = getCruzeiroPool();
  const cached = await db.query<{ cep: string | null; lat: number | null; lng: number | null }>(
    'SELECT cep, lat, lng FROM ativacao_locais WHERE local_key = $1',
    [key]
  );
  const hit = cached.rows[0];
  if (hit?.lat != null && hit.lng != null) {
    return { cep: hit.cep, lat: hit.lat, lng: hit.lng, bairro };
  }

  if (!isRuaValida(endereco) && !isLocalValido(cidade, bairro)) {
    return { cep: null, lat: null, lng: null, bairro: bairro || null };
  }

  const geo = await geocodeAlunoLocal(cidade, bairro, endereco);
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
    [key, cidade, bairro, geo?.cep ?? null, geo?.lat ?? null, geo?.lng ?? null]
  );
  return {
    cep: geo?.cep ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    bairro: bairro || null,
  };
}

async function ensureSyncTable() {
  const db = getCruzeiroPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS ativacao_locais (
      local_key text PRIMARY KEY,
      cidade text NOT NULL,
      bairro text NOT NULL DEFAULT '',
      cep text,
      lat double precision,
      lng double precision,
      geocoded_at timestamptz,
      tentativas integer NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ativacao_geo_sync (
      id integer PRIMARY KEY CHECK (id = 1),
      snapshot_id integer,
      snapshot_uploaded_at timestamptz,
      ran_at timestamptz
    );
  `);
}

export async function statusAlunosCep(): Promise<AlunosCepSyncStatus> {
  await ensureSyncTable();
  const db = getCruzeiroPool();
  const [snapshot, sync, alunos] = await Promise.all([
    db.query<{ id: number; uploaded_at: Date }>(LATEST_MATRICULADOS),
    db.query<{ snapshot_id: number | null; ran_at: Date | null }>(
      'SELECT snapshot_id, ran_at FROM ativacao_geo_sync WHERE id = 1'
    ),
    countAlunosCep(),
  ]);
  const current = snapshot.rows[0] || null;
  const last = sync.rows[0] || null;
  return {
    snapshotId: current?.id ?? null,
    snapshotUploadedAt: current?.uploaded_at?.toISOString() ?? null,
    lastSyncAt: last?.ran_at?.toISOString() ?? null,
    lastSyncSnapshotId: last?.snapshot_id ?? null,
    alunos,
    precisaSincronizar: Boolean(current && last?.snapshot_id !== current.id),
  };
}

export async function sincronizarAlunosCep(): Promise<AlunosCepSyncResult> {
  await ensureSyncTable();
  const db = getCruzeiroPool();
  const snapshot = await db.query<{ id: number; uploaded_at: Date }>(LATEST_MATRICULADOS);
  const current = snapshot.rows[0];
  if (!current) throw new Error('Nenhum snapshot de matriculados encontrado.');

  const last = await db.query<{ snapshot_id: number | null }>(
    'SELECT snapshot_id FROM ativacao_geo_sync WHERE id = 1'
  );
  const lastId = last.rows[0]?.snapshot_id ?? null;

  const atuais = await listAlunosSnapshot(current.id);
  const gravados = new Set(await listAlunosCepTelefones());
  const removidos = [...gravados].filter((telefone) => !atuais.has(telefone));
  const alunosRemovidos = await deleteAlunosCepByTelefones(removidos);

  if (lastId == null) {
    await markSync(current.id, current.uploaded_at);
    const status = await statusAlunosCep();
    return { ...status, alunosNovos: 0, alunosRemovidos, inicializado: true };
  }

  if (lastId === current.id) {
    const { repararAlunosCepPorRua } = await import('./alunos-cep-repair');
    await repararAlunosCepPorRua(6);
    const status = await statusAlunosCep();
    return { ...status, alunosNovos: 0, alunosRemovidos, inicializado: false };
  }

  const anteriores = await listAlunosSnapshot(lastId);
  const novos: AlunoCepRow[] = [];
  for (const [telefone, aluno] of atuais) {
    if (anteriores.has(telefone) || gravados.has(telefone)) continue;
    const local = await resolverLocal(aluno.cidade, aluno.bairro, aluno.endereco);
    novos.push({
      rgm: aluno.rgm,
      telefone,
      cep: local.cep,
      bairro: local.bairro,
      lat: local.lat,
      lng: local.lng,
    });
  }

  await upsertAlunosCep(novos);
  await markSync(current.id, current.uploaded_at);
  const status = await statusAlunosCep();
  return {
    ...status,
    alunosNovos: novos.length,
    alunosRemovidos,
    inicializado: false,
  };
}
