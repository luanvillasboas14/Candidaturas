import { getCruzeiroPool } from '@/lib/cruzeiro-db';
import { geocodeCidadeBairro, isLocalValido, localKey } from './geo-local';
import { LATEST_MATRICULADOS, LINHA_VALIDA } from './queries';

const SCHEMA = `
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
CREATE TABLE IF NOT EXISTS ativacao_alunos_geo (
  pessoa_id text PRIMARY KEY,
  local_key text NOT NULL REFERENCES ativacao_locais (local_key),
  snapshot_id integer NOT NULL
);
CREATE TABLE IF NOT EXISTS ativacao_geo_sync (
  id integer PRIMARY KEY CHECK (id = 1),
  snapshot_id integer,
  snapshot_uploaded_at timestamptz,
  ran_at timestamptz
);
`;

export type GeoSyncStatus = {
  snapshotId: number | null;
  snapshotUploadedAt: string | null;
  lastSyncAt: string | null;
  lastSyncSnapshotId: number | null;
  alunos: number;
  locais: number;
  locaisComCoord: number;
  pendentes: number;
  precisaSincronizar: boolean;
};

export type GeoSyncResult = GeoSyncStatus & {
  alunosNovos: number;
  alunosRemovidos: number;
  locaisGeocodificados: number;
};

async function ensureSchema() {
  const db = getCruzeiroPool();
  await db.query(SCHEMA);
}

export async function statusGeoSync(): Promise<GeoSyncStatus> {
  await ensureSchema();
  const db = getCruzeiroPool();
  const [snapshot, sync, counts] = await Promise.all([
    db.query<{ id: number; uploaded_at: Date }>(LATEST_MATRICULADOS),
    db.query<{ snapshot_id: number | null; ran_at: Date | null }>(
      'SELECT snapshot_id, ran_at FROM ativacao_geo_sync WHERE id = 1'
    ),
    db.query<{ alunos: string; locais: string; ok: string; pendentes: string }>(`
      SELECT
        (SELECT COUNT(*) FROM ativacao_alunos_geo) AS alunos,
        (SELECT COUNT(*) FROM ativacao_locais) AS locais,
        (SELECT COUNT(*) FROM ativacao_locais WHERE lat IS NOT NULL) AS ok,
        (SELECT COUNT(*) FROM ativacao_locais WHERE lat IS NULL AND tentativas < 3) AS pendentes
    `),
  ]);

  const current = snapshot.rows[0] || null;
  const last = sync.rows[0] || null;
  const tally = counts.rows[0];
  const pendentes = Number(tally?.pendentes || 0);

  return {
    snapshotId: current?.id ?? null,
    snapshotUploadedAt: current?.uploaded_at?.toISOString() ?? null,
    lastSyncAt: last?.ran_at?.toISOString() ?? null,
    lastSyncSnapshotId: last?.snapshot_id ?? null,
    alunos: Number(tally?.alunos || 0),
    locais: Number(tally?.locais || 0),
    locaisComCoord: Number(tally?.ok || 0),
    pendentes,
    precisaSincronizar: !current || last?.snapshot_id !== current.id || pendentes > 0,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sincronizarGeo(limite = 25): Promise<GeoSyncResult> {
  await ensureSchema();
  const db = getCruzeiroPool();
  const snapshot = await db.query<{ id: number; uploaded_at: Date }>(LATEST_MATRICULADOS);
  const current = snapshot.rows[0];
  if (!current) {
    throw new Error('Nenhum snapshot de matriculados encontrado.');
  }

  const atuais = await db.query<{ pessoa_id: string; cidade: string; bairro: string }>(
    `
    SELECT DISTINCT ON (pessoa_id)
      pessoa_id,
      cidade,
      bairro
    FROM (
      SELECT
        COALESCE(
          NULLIF(TRIM(r.data->>'rgm_digits'), ''),
          NULLIF(TRIM(r.data->>'cpf_digits'), '')
        ) AS pessoa_id,
        COALESCE(NULLIF(TRIM(r.data->>'cidade'), ''), '') AS cidade,
        COALESCE(NULLIF(TRIM(r.data->>'bairro'), ''), '') AS bairro
      FROM xl_rows r
      WHERE r.snapshot_id = $1
        AND ${LINHA_VALIDA}
    ) t
    WHERE pessoa_id IS NOT NULL
    ORDER BY pessoa_id
    `,
    [current.id]
  );

  const locais = new Map<string, { cidade: string; bairro: string }>();
  const alunos: Array<{ pessoaId: string; key: string }> = [];
  for (const row of atuais.rows) {
    if (!isLocalValido(row.cidade, row.bairro)) continue;
    const key = localKey(row.cidade, row.bairro);
    locais.set(key, { cidade: row.cidade, bairro: row.bairro });
    alunos.push({ pessoaId: row.pessoa_id, key });
  }

  if (!alunos.length) {
    throw new Error('Snapshot de matriculados sem alunos de graduação.');
  }

  const existentes = await db.query<{ pessoa_id: string }>('SELECT pessoa_id FROM ativacao_alunos_geo');
  const existentesSet = new Set(existentes.rows.map((row) => row.pessoa_id));
  const alunosNovos = alunos.filter((aluno) => !existentesSet.has(aluno.pessoaId)).length;

  if (locais.size) {
    const keys = [...locais.keys()];
    const cidades = keys.map((key) => locais.get(key)!.cidade);
    const bairros = keys.map((key) => locais.get(key)!.bairro);
    await db.query(
      `
      INSERT INTO ativacao_locais (local_key, cidade, bairro)
      SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])
      ON CONFLICT (local_key) DO NOTHING
      `,
      [keys, cidades, bairros]
    );
  }

  if (alunos.length) {
    const ids = alunos.map((aluno) => aluno.pessoaId);
    const keys = alunos.map((aluno) => aluno.key);
    await db.query(
      `
      INSERT INTO ativacao_alunos_geo (pessoa_id, local_key, snapshot_id)
      SELECT pessoa_id, local_key, $3
      FROM UNNEST($1::text[], $2::text[]) AS t(pessoa_id, local_key)
      ON CONFLICT (pessoa_id) DO UPDATE
        SET local_key = EXCLUDED.local_key,
            snapshot_id = EXCLUDED.snapshot_id
      `,
      [ids, keys, current.id]
    );
  }

  const removidos = await db.query<{ count: string }>(
    `
    WITH deleted AS (
      DELETE FROM ativacao_alunos_geo
      WHERE NOT (pessoa_id = ANY($1::text[]))
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM deleted
    `,
    [alunos.map((aluno) => aluno.pessoaId)]
  );

  await db.query(`
    DELETE FROM ativacao_locais l
    WHERE NOT EXISTS (
      SELECT 1 FROM ativacao_alunos_geo a WHERE a.local_key = l.local_key
    )
  `);

  const pendentes = await db.query<{ local_key: string; cidade: string; bairro: string }>(
    `
    SELECT local_key, cidade, bairro
    FROM ativacao_locais
    WHERE lat IS NULL AND tentativas < 3
    ORDER BY local_key
    LIMIT $1
    `,
    [Math.min(80, Math.max(1, limite))]
  );

  let geocodificados = 0;
  for (const local of pendentes.rows) {
    const geo = await geocodeCidadeBairro(local.cidade, local.bairro);
    if (geo) {
      await db.query(
        `
        UPDATE ativacao_locais
        SET cep = $2, lat = $3, lng = $4, geocoded_at = NOW(), tentativas = tentativas + 1
        WHERE local_key = $1
        `,
        [local.local_key, geo.cep, geo.lat, geo.lng]
      );
      geocodificados += 1;
    } else {
      await db.query(
        `UPDATE ativacao_locais SET tentativas = tentativas + 1, geocoded_at = NOW() WHERE local_key = $1`,
        [local.local_key]
      );
    }
    await sleep(200);
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

  const status = await statusGeoSync();
  return {
    ...status,
    alunosNovos,
    alunosRemovidos: Number(removidos.rows[0]?.count || 0),
    locaisGeocodificados: geocodificados,
  };
}
