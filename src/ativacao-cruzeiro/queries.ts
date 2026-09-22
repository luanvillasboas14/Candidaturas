import { getCruzeiroPool } from '@/lib/cruzeiro-db';
import { normalizePhone } from '@/lib/phone';
import { appendVagaEnviada, listAlunosCepLocalizacoes, listTelefonesComVagaEnviada } from '@/lib/supabase-server';
import { geocodeCep, haversineKm, normalizeCep } from '@/vagas-proximas/geo';
import type { AlunoCruzeiro, FiltrosAtivacao, OpcoesAtivacao } from './types';

export type { AlunoCruzeiro, FiltrosAtivacao, OpcoesAtivacao };

export const LATEST_MATRICULADOS = `
  SELECT id, uploaded_at
  FROM xl_snapshots
  WHERE tipo = 'matriculados'
  ORDER BY uploaded_at DESC, id DESC
  LIMIT 1
`;

export const LINHA_VALIDA = `
  NULLIF(TRIM(r.data->>'nome'), '') IS NOT NULL
  AND COALESCE(TRIM(r.data->>'ciclo'), '') NOT IN ('Total')
  AND COALESCE(TRIM(r.data->>'ciclo'), '') NOT ILIKE 'Filtros%'
  AND TRIM(r.data->>'negocio') ILIKE 'gradua%'
`;

const CURSO_GRUPO = `
  TRIM(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(TRIM(r.data->>'curso'), '\\s*\\([^)]*\\)', '', 'g'),
        '\\s*\\(.*$', ''
      ),
      '\\s+4\\.0I?(?:\\s+MAIS)?$',
      '',
      'i'
    ),
    '\\s+',
    ' ',
    'g'
  ))
`;

const BASE_ALUNOS = `
  WITH latest AS (${LATEST_MATRICULADOS}),
  base AS (
    SELECT
      r.id,
      NULLIF(TRIM(r.data->>'rgm_digits'), '') AS rgm,
      NULLIF(TRIM(r.data->>'cpf_digits'), '') AS cpf,
      NULLIF(TRIM(r.data->>'nome'), '') AS nome,
      ${CURSO_GRUPO} AS curso,
      NULLIF(TRIM(r.data->>'serie'), '') AS serie,
      NULLIF(UPPER(TRIM(r.data->>'sexo')), '') AS sexo,
      NULLIF(TRIM(r.data->>'polo'), '') AS polo,
      NULLIF(TRIM(r.data->>'bairro'), '') AS bairro,
      NULLIF(TRIM(r.data->>'fone_cel'), '') AS celular,
      NULLIF(TRIM(r.data->>'phones_digits'), '') AS phones_digits,
      CASE
        WHEN r.data->>'data_nasc' ~ '^\\d{2}/\\d{2}/\\d{4}$'
        THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, to_date(r.data->>'data_nasc', 'DD/MM/YYYY')))::int
        WHEN r.data->>'data_nasc' ~ '^\\d{4}-\\d{2}-\\d{2}'
        THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (LEFT(r.data->>'data_nasc', 10))::date))::int
        ELSE NULL
      END AS idade
    FROM xl_rows r
    WHERE r.snapshot_id = (SELECT id FROM latest)
      AND ${LINHA_VALIDA}
  ),
  filtered AS (
    SELECT
      *,
      COALESCE(rgm, cpf, 'row-' || id::text) AS pessoa_id
    FROM base
    WHERE ($1::int IS NULL OR (idade IS NOT NULL AND idade >= $1 AND idade <= $2))
      AND ($3::text IS NULL OR curso = $3)
      AND ($4::text[] IS NULL OR serie = ANY($4))
      AND ($5::text IS NULL OR sexo = $5)
  ),
  unicos AS (
    SELECT DISTINCT ON (pessoa_id)
      pessoa_id,
      nome,
      curso,
      serie,
      idade,
      polo,
      bairro,
      celular,
      phones_digits
    FROM filtered
    ORDER BY pessoa_id, serie DESC NULLS LAST, curso ASC NULLS LAST, id ASC
  )
`;

function parseAge(value?: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const age = Math.trunc(value);
  if (age < 1 || age > 120) return null;
  return age;
}

function normalizeSexo(value?: string): string | null {
  const raw = value?.trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'F' || raw === 'FEMININO') return 'F';
  if (raw === 'M' || raw === 'MASCULINO') return 'M';
  return null;
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeRaio(value?: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const raio = Number(value);
  if (raio < 1 || raio > 80) return null;
  return raio;
}

function normalizeQuantidade(value?: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const quantidade = Math.trunc(value);
  if (quantidade < 1 || quantidade > 40000) return null;
  return quantidade;
}

function normalizeSeries(value?: string | string[]): string[] | null {
  const raw = Array.isArray(value) ? value : value ? value.split(',') : [];
  const series = [
    ...new Set(raw.map((item) => item.trim()).filter((item) => /^\d{1,2}$/.test(item))),
  ];
  return series.length ? series : null;
}

export function normalizeFiltros(input: FiltrosAtivacao): {
  idadeMin: number | null;
  idadeMax: number | null;
  curso: string | null;
  serie: string[] | null;
  sexo: string | null;
  bairro: string | null;
  cep: string | null;
  raioKm: number | null;
  vagaId: string | null;
  quantidade: number | null;
  page: number;
  pageSize: number;
} {
  const idadeMin = parseAge(input.idadeMin);
  const idadeMax = parseAge(input.idadeMax);
  const idadeCompleta = idadeMin != null && idadeMax != null;
  const [min, max] =
    idadeCompleta && idadeMin > idadeMax ? [idadeMax, idadeMin] : [idadeMin, idadeMax];

  const curso = input.curso?.trim() || null;
  const serie = normalizeSeries(input.serie);
  const sexo = normalizeSexo(input.sexo);
  const bairro = input.bairro?.trim() || null;
  const cep = normalizeCep(input.cep || '');
  const raioKm = normalizeRaio(input.raioKm);
  const cepRaio = cep && raioKm ? { cep, raioKm } : null;
  const vagaId = input.vagaId?.trim() || null;
  const quantidade = normalizeQuantidade(input.quantidade);

  const pageSize = quantidade ?? Math.min(100, Math.max(1, input.pageSize || 50));
  const page = quantidade ? 1 : Math.max(1, input.page || 1);

  return {
    idadeMin: idadeCompleta ? min : null,
    idadeMax: idadeCompleta ? max : null,
    curso,
    serie,
    sexo,
    bairro,
    cep: cepRaio?.cep ?? null,
    raioKm: cepRaio?.raioKm ?? null,
    vagaId,
    quantidade,
    page,
    pageSize,
  };
}

export function temFiltroAtivo(input: FiltrosAtivacao): boolean {
  const filtros = normalizeFiltros(input);
  return Boolean(
    filtros.idadeMin != null ||
      filtros.curso ||
      filtros.serie?.length ||
      filtros.sexo ||
      filtros.bairro ||
      filtros.cep
  );
}

export async function listarOpcoesAtivacao(): Promise<OpcoesAtivacao> {
  const db = getCruzeiroPool();
  const [cursos, series] = await Promise.all([
    db.query<{ curso: string }>(
      `
      WITH latest AS (${LATEST_MATRICULADOS})
      SELECT DISTINCT ${CURSO_GRUPO} AS curso
      FROM xl_rows r
      WHERE r.snapshot_id = (SELECT id FROM latest)
        AND ${LINHA_VALIDA}
        AND NULLIF(TRIM(r.data->>'curso'), '') IS NOT NULL
      ORDER BY 1
      `
    ),
    db.query<{ serie: string }>(
      `
      WITH latest AS (${LATEST_MATRICULADOS}),
      series AS (
        SELECT DISTINCT TRIM(r.data->>'serie') AS serie
        FROM xl_rows r
        WHERE r.snapshot_id = (SELECT id FROM latest)
          AND ${LINHA_VALIDA}
          AND TRIM(r.data->>'serie') ~ '^\\d+$'
      )
      SELECT serie FROM series ORDER BY serie::int
      `
    ),
  ]);

  return {
    cursos: cursos.rows.map((row) => row.curso).filter(Boolean),
    series: series.rows.map((row) => row.serie),
    sexos: [
      { valor: 'F', label: 'Feminino' },
      { valor: 'M', label: 'Masculino' },
    ],
  };
}

type AlunoQueryRow = AlunoCruzeiro & { phones_digits?: string | null };

function telefoneAluno(row: AlunoQueryRow): string | null {
  return normalizePhone(row.phones_digits || row.celular || '');
}

async function aplicarLocalizacao(
  alunos: AlunoQueryRow[],
  bairro: string | null,
  cep: string | null,
  raioKm: number | null
): Promise<AlunoCruzeiro[]> {
  if (!bairro && !cep) {
    return alunos.map((row) => ({
      pessoaId: row.pessoaId,
      nome: row.nome,
      curso: row.curso,
      serie: row.serie,
      idade: row.idade,
      polo: row.polo,
      celular: row.celular,
      telefone: telefoneAluno(row) || '',
      bairro: row.bairro || '',
    }));
  }

  const locais = await listAlunosCepLocalizacoes();
  const porTelefone = new Map(locais.map((local) => [local.telefone, local]));

  let origem: { lat: number; lng: number } | null = null;
  if (cep && raioKm) {
    origem = await geocodeCep(cep);
    if (!origem) {
      throw new Error('Não foi possível localizar esse CEP.');
    }
  }

  const termoBairro = bairro ? fold(bairro) : '';
  const filtrados: AlunoCruzeiro[] = [];

  for (const row of alunos) {
    const telefone = telefoneAluno(row);
    const geo = telefone ? porTelefone.get(telefone) : undefined;
    const bairroAluno = geo?.bairro || row.bairro || '';
    const distanciaKm =
      origem && geo?.lat != null && geo.lng != null
        ? Number(haversineKm(origem, { lat: geo.lat, lng: geo.lng }).toFixed(1))
        : null;

    if (termoBairro && !fold(bairroAluno).includes(termoBairro)) continue;
    if (origem && raioKm != null && (distanciaKm == null || distanciaKm > raioKm)) continue;

    filtrados.push({
      pessoaId: row.pessoaId,
      nome: row.nome,
      curso: row.curso,
      serie: row.serie,
      idade: row.idade,
      polo: row.polo,
      celular: row.celular,
      telefone: telefone || '',
      bairro: bairroAluno,
      distanciaKm,
    });
  }

  return filtrados.sort((a, b) => {
    if (a.distanciaKm != null && b.distanciaKm != null && a.distanciaKm !== b.distanciaKm) {
      return a.distanciaKm - b.distanciaKm;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

export async function listarAlunosAtivacao(input: FiltrosAtivacao): Promise<{
  total: number;
  page: number;
  pageSize: number;
  alunos: AlunoCruzeiro[];
}> {
  const filtros = normalizeFiltros(input);
  if (!temFiltroAtivo(input)) {
    return { total: 0, page: filtros.page, pageSize: filtros.pageSize, alunos: [] };
  }

  const usaLocal = Boolean(filtros.bairro || filtros.cep);
  const precisaTodos = usaLocal || Boolean(filtros.vagaId);
  const offset = (filtros.page - 1) * filtros.pageSize;
  const params = [filtros.idadeMin, filtros.idadeMax, filtros.curso, filtros.serie, filtros.sexo];
  const db = getCruzeiroPool();

  const lista = await db.query<AlunoQueryRow>(
    `
    ${BASE_ALUNOS}
    SELECT
      pessoa_id AS "pessoaId",
      nome,
      COALESCE(curso, '') AS curso,
      COALESCE(serie, '') AS serie,
      idade,
      COALESCE(polo, '') AS polo,
      COALESCE(bairro, '') AS bairro,
      COALESCE(celular, '') AS celular,
      phones_digits
    FROM unicos
    ORDER BY nome ASC NULLS LAST
    ${precisaTodos ? '' : 'LIMIT $6 OFFSET $7'}
    `,
    precisaTodos ? params : [...params, filtros.pageSize, offset]
  );

  let alunos: AlunoCruzeiro[] = usaLocal
    ? await aplicarLocalizacao(lista.rows, filtros.bairro, filtros.cep, filtros.raioKm)
    : lista.rows.map((row) => ({
        pessoaId: row.pessoaId,
        nome: row.nome,
        curso: row.curso,
        serie: row.serie,
        idade: row.idade,
        polo: row.polo,
        celular: row.celular,
        telefone: telefoneAluno(row) || '',
        bairro: row.bairro || '',
      }));

  if (filtros.vagaId) {
    const enviados = new Set(await listTelefonesComVagaEnviada(filtros.vagaId));
    alunos = alunos.filter((aluno) => aluno.telefone && !enviados.has(aluno.telefone));
  }

  if (!precisaTodos) {
    const count = await db.query<{ total: string }>(
      `${BASE_ALUNOS} SELECT COUNT(*)::int AS total FROM unicos`,
      params
    );
    return {
      total: Number(count.rows[0]?.total || 0),
      page: filtros.page,
      pageSize: filtros.pageSize,
      alunos,
    };
  }

  return {
    total: alunos.length,
    page: filtros.page,
    pageSize: filtros.pageSize,
    alunos: alunos.slice(offset, offset + filtros.pageSize),
  };
}

export async function registrarEnvioAtivacao(input: FiltrosAtivacao): Promise<{
  gravados: number;
  vagaId: string;
}> {
  const vagaId = input.vagaId?.trim();
  if (!vagaId) {
    throw new Error('Escolha a vaga para registrar o envio.');
  }
  if (!normalizeQuantidade(input.quantidade)) {
    throw new Error('Informe quantas pessoas você quer ativar.');
  }

  const lista = await listarAlunosAtivacao({ ...input, vagaId });
  const gravados = await appendVagaEnviada(
    lista.alunos.map((aluno) => ({ rgm: aluno.pessoaId, telefone: aluno.telefone })),
    vagaId
  );
  return { gravados, vagaId };
}
