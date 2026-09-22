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
