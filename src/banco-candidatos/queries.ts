import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { getDnaWorkPool, type DnaRow } from '@/lib/dna-work-db';
import { geocodeCep } from '@/vagas-proximas/geo';
import type {
  CandidatoDetalhe,
  CandidatoLista,
  DocumentoGerado,
  FiltrosBanco,
  FormacaoOpcao,
  ListaBanco,
  ModalidadeOpcao,
  OcorrenciaCandidato,
} from './types';
import { isStatusCandidato } from './types';
import { normalizarResumoAtividades } from './ui';

function idadeDe(dataNasc: string | null): number | null {
  if (!dataNasc) return null;
  const iso = dataIso(dataNasc);
  if (!iso) return null;
  const data = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - data.getFullYear();
  const mes = hoje.getMonth() - data.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < data.getDate())) idade -= 1;
  return idade;
}

export function dataIso(raw: string | Date | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) return trimmed.slice(0, 10).replaceAll('/', '-');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [dia, mes, ano] = trimmed.split('/');
    return `${ano}-${mes}-${dia}`;
  }
  return null;
}

export function dataBr(raw: string | null | undefined): string {
  const iso = dataIso(raw);
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function dataBanco(raw: string | null | undefined): string {
  const iso = dataIso(raw);
  return iso ? iso.replaceAll('-', '/') : '';
}

function mapLista(row: DnaRow): CandidatoLista {
  return {
    idCandidato: String(row.id_candidato),
    status: isStatusCandidato(String(row.status_candidato || ''))
      ? (String(row.status_candidato) as CandidatoLista['status'])
      : null,
    encaminhado: Boolean(row.id_emcaminhamento),
    nome: row.nome || '',
    idade: idadeDe(row.datanascimento),
    terminoEstudo: dataBr(row.terminoestudo) || row.terminoestudo || null,
    tipoEnsino: row.tipo_ensino || null,
    instituicao: row.nome_fantasia || null,
    curso: row.curso || null,
    bairro: row.bairro || null,
    cidade: row.cidade || null,
    estado: row.estado || null,
    dataCadastro: dataBr(row.datacadastro || row.data_adicao),
    contratado: Number(row.status_contratacao) === 1,
    idVaga: row.id_vaga || null,
    tipoVaga: row.tipo_vaga == null ? null : Number(row.tipo_vaga),
    cargoVaga: row.cargo_vaga || null,
    distanciaKm: row.distancia_km == null ? null : Number(row.distancia_km),
  };
}

export async function listarFormacoes(): Promise<FormacaoOpcao[]> {
  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT id_flex AS id, valor FROM flex WHERE tipo = 2 ORDER BY id_flex`
  );
  return rows.map((row) => ({ id: Number(row.id), valor: String(row.valor || '') }));
}

export async function listarModalidades(): Promise<ModalidadeOpcao[]> {
  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT id, descricao FROM modalidade_vaga ORDER BY id`
  );
  return rows.map((row) => ({ id: Number(row.id), descricao: String(row.descricao || '') }));
}

export async function normalizarFiltros(input: FiltrosBanco): Promise<FiltrosBanco> {
  const filtros = { ...input };
  if (filtros.cep && (filtros.lat == null || filtros.lng == null) && filtros.raioKm) {
    const ponto = await geocodeCep(filtros.cep);
    if (ponto) {
      filtros.lat = ponto.lat;
      filtros.lng = ponto.lng;
    }
  }
  return filtros;
}

function whereLista(filtros: FiltrosBanco): { sql: string; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  const nome = filtros.nome?.trim() || '';
  if (nome.length >= 3) {
    clauses.push(`c.nome LIKE ?`);
    params.push(`${nome}%`);
  }
  if (filtros.cadastroDe) {
    clauses.push(`DATE(c.data_adicao) >= ?`);
    params.push(filtros.cadastroDe);
  }
  if (filtros.cadastroAte) {
    clauses.push(`DATE(c.data_adicao) <= ?`);
    params.push(filtros.cadastroAte);
  }
  if (filtros.formacao) {
    clauses.push(`c.modalidadecurso = ?`);
    params.push(String(filtros.formacao));
  }
  if (filtros.salarioMin != null && Number.isFinite(filtros.salarioMin)) {
    clauses.push(`c.pretencao_salarial >= ?`);
    params.push(filtros.salarioMin);
  }
  if (filtros.salarioMax != null && Number.isFinite(filtros.salarioMax)) {
    clauses.push(`c.pretencao_salarial <= ?`);
    params.push(filtros.salarioMax);
  }
  if (filtros.cargo?.trim()) {
    clauses.push(`(
      EXISTS (
        SELECT 1 FROM cargos_candidato cc
        WHERE cc.id_candidato = c.id_candidato AND cc.cargo LIKE ?
      )
      OR EXISTS (
        SELECT 1 FROM exp_proficional ep
        WHERE ep.id_canditado = c.id_candidato AND ep.cargo LIKE ?
      )
    )`);
    const like = `%${filtros.cargo.trim()}%`;
    params.push(like, like);
  }
  if (filtros.tipoContratacao) {
    clauses.push(`EXISTS (
      SELECT 1 FROM conratacaovaga cvt
      JOIN vaga vt ON vt.id_vaga = cvt.id_vaga
      WHERE cvt.id_candidato = c.id_candidato AND cvt.status = 1 AND vt.tipo_vaga = ?
    )`);
    params.push(filtros.tipoContratacao);
  }
  if (filtros.status && filtros.status !== 'todos') {
    clauses.push(statusWhere(filtros.status));
  }
  if (filtros.lat != null && filtros.lng != null && filtros.raioKm && filtros.raioKm > 0) {
    clauses.push(`
      c.lat IS NOT NULL AND c.lng IS NOT NULL AND c.lat <> '' AND c.lng <> ''
      AND (
        6371 * ACOS(LEAST(1,
          COS(RADIANS(?)) * COS(RADIANS(CAST(c.lat AS DECIMAL(10,6))))
          * COS(RADIANS(CAST(c.lng AS DECIMAL(10,6))) - RADIANS(?))
          + SIN(RADIANS(?)) * SIN(RADIANS(CAST(c.lat AS DECIMAL(10,6))))
        ))
      ) <= ?
    `);
    params.push(filtros.lat, filtros.lng, filtros.lat, filtros.raioKm);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

const CONTRATADO_SQL = `EXISTS (SELECT 1 FROM conratacaovaga x WHERE x.id_candidato = c.id_candidato AND x.status = 1)`;
const ENCAMINHADO_SQL = `EXISTS (SELECT 1 FROM emcaminhamento e2 WHERE e2.id_candidato = c.id_candidato AND (e2.reprovado IS NULL OR e2.reprovado = ''))`;
const DEMITIDO_SQL = `EXISTS (SELECT 1 FROM conratacaovaga x WHERE x.id_candidato = c.id_candidato AND x.status = 2)`;

function statusWhere(status: string): string {
  if (status === 'contratado') return CONTRATADO_SQL;
  if (status === 'encaminhado') return `NOT ${CONTRATADO_SQL} AND ${ENCAMINHADO_SQL}`;
  if (status === 'demitido') return `NOT ${CONTRATADO_SQL} AND NOT ${ENCAMINHADO_SQL} AND ${DEMITIDO_SQL}`;
  if (status === 'disponivel') return `NOT ${CONTRATADO_SQL} AND NOT ${ENCAMINHADO_SQL} AND NOT ${DEMITIDO_SQL}`;
  return '';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function listarCandidatos(input: FiltrosBanco): Promise<ListaBanco> {
  const filtros = await normalizarFiltros(input);
  const page = Math.max(1, filtros.page || 1);
  const pageSize = 50;
  const { sql, params } = whereLista(filtros);
  const usouRaio = Boolean(filtros.lat != null && filtros.lng != null && filtros.raioKm && filtros.raioKm > 0);

  const [[countRow]] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT COUNT(*) AS total FROM candidato c ${sql}`,
    params
  );

  const offset = (page - 1) * pageSize;
  const [baseRows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT
      c.id_candidato,
      c.nome,
      c.datanascimento,
      c.terminoestudo,
      c.curso,
      c.bairro,
      c.cidade,
      c.estado,
      c.datacadastro,
      c.data_adicao,
      c.lat,
      c.lng
    FROM candidato c
    ${sql}
    ORDER BY c.data_adicao DESC
    LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  );

  const ids = baseRows.map((row) => String(row.id_candidato));
  const extraPorId = new Map<string, DnaRow>();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const [extraRows] = await getDnaWorkPool().query<DnaRow[]>(
      `
      SELECT
        c.id_candidato,
        f.valor AS tipo_ensino,
        i.nome_fantasia,
        e.id_emcaminhamento,
        cv.status AS status_contratacao,
        cv.id_vaga,
        v.tipo_vaga,
        v.cargo AS cargo_vaga,
        s.status AS status_candidato
      FROM candidato c
      LEFT JOIN flex f ON f.id_flex = c.modalidadecurso
      LEFT JOIN instituicao i ON i.id_instiduicao = c.escola
      LEFT JOIN (
        SELECT id_candidato, MIN(id_emcaminhamento) AS id_emcaminhamento
        FROM emcaminhamento
        WHERE reprovado IS NULL AND id_candidato IN (${placeholders})
        GROUP BY id_candidato
      ) e ON e.id_candidato = c.id_candidato
      LEFT JOIN conratacaovaga cv ON cv.id_candidato = c.id_candidato AND cv.status = 1
      LEFT JOIN vaga v ON v.id_vaga = cv.id_vaga
      LEFT JOIN vw_candidato_status s ON s.id_candidato = c.id_candidato
      WHERE c.id_candidato IN (${placeholders})
      `,
      [...ids, ...ids]
    );
    for (const row of extraRows) {
      extraPorId.set(String(row.id_candidato), row);
    }
  }

  return {
    total: Number(countRow?.total || 0),
    page,
    pageSize,
    usouRaio,
    candidatos: baseRows.map((row) => {
      const extra = extraPorId.get(String(row.id_candidato));
      let distancia: number | null = null;
      if (usouRaio && filtros.lat != null && filtros.lng != null) {
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          distancia = Math.round(haversineKm(filtros.lat, filtros.lng, lat, lng) * 10) / 10;
        }
      }
      return mapLista({
        ...row,
        ...extra,
        distancia_km: distancia,
      });
    }),
  };
}

export async function getCandidatoDetalhe(
  idCandidato: string,
  idVaga?: string
): Promise<CandidatoDetalhe | null> {
  const params: string[] = [];
  let vagaSql = 'cv.status = 1';
  if (idVaga) {
    vagaSql = 'cv.id_vaga = ?';
    params.push(idVaga);
  }

  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT
      c.id_candidato,
      c.nome,
      c.email,
      c.telefonefixo,
      c.celular,
      c.cpf,
      c.datanascimento,
      c.terminoestudo,
      c.curso,
      c.bairro,
      c.cidade,
      c.estado,
      c.datacadastro,
      c.data_adicao,
      f.valor AS tipo_ensino,
      i.nome_fantasia,
      s.status AS status_candidato,
      e.id_emcaminhamento,
      cv.status AS status_contratacao,
      cv.id_vaga,
      cv.datainicio,
      cv.datafim,
      v.tipo_vaga,
      v.cargo AS cargo_vaga,
      v.atribu_contrato,
      emp.nome_fantasia AS empresa
    FROM candidato c
    INNER JOIN vw_candidato_status s ON s.id_candidato = c.id_candidato
    LEFT JOIN flex f ON f.id_flex = c.modalidadecurso
    LEFT JOIN instituicao i ON i.id_instiduicao = c.escola
    LEFT JOIN (
      SELECT id_candidato, MIN(id_emcaminhamento) AS id_emcaminhamento
      FROM emcaminhamento
      WHERE reprovado IS NULL
      GROUP BY id_candidato
    ) e ON e.id_candidato = c.id_candidato
    LEFT JOIN conratacaovaga cv ON cv.id_candidato = c.id_candidato AND ${vagaSql}
    LEFT JOIN vaga v ON v.id_vaga = cv.id_vaga
    LEFT JOIN empresa emp ON emp.id_empresa = cv.id_empresa
    WHERE c.id_candidato = ?
    LIMIT 1
    `,
    [...params, idCandidato]
  );
  const row = rows[0];
  if (!row) return null;

  const vagaId = row.id_vaga ? String(row.id_vaga) : '';
  const [demitido] = vagaId
    ? await getDnaWorkPool().query<DnaRow[]>(
        `SELECT id_candidato FROM demissao WHERE id_candidato = ? AND id_vaga = ? LIMIT 1`,
        [idCandidato, vagaId]
      )
    : [[]];

  const [encRows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT v.cargo, emp.nome_fantasia AS empresa
    FROM emcaminhamento e
    LEFT JOIN vaga v ON v.id_vaga = e.id_vaga
    LEFT JOIN empresa emp ON emp.id_empresa = v.id_empresa
    WHERE e.id_candidato = ? AND e.reprovado IS NULL
    ORDER BY e.id_emcaminhamento DESC
    LIMIT 1
    `,
    [idCandidato]
  );

  return {
    ...mapLista(row),
    email: row.email || null,
    telefone: row.telefonefixo || null,
    celular: row.celular || null,
    cpf: row.cpf || null,
    dataInicio: dataBr(row.datainicio),
    dataFim: dataBr(row.datafim),
    empresa: row.empresa || null,
    jaDemitido: demitido.length > 0,
    encaminhamentoCargo: encRows[0]?.cargo || null,
    encaminhamentoEmpresa: encRows[0]?.empresa || null,
    documentos: await listarDocumentos(idCandidato),
    ocorrencias: await listarOcorrencias(idCandidato),
    atribuicoes: normalizarResumoAtividades(row.atribu_contrato) || null,
  };
}

export async function listarDocumentos(idCandidato: string): Promise<DocumentoGerado[]> {
  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT
      cg.id_contratogerado,
      cg.nome_contrato,
      cg.vaga,
      cg.data,
      cg.status,
      v.cargo,
      emp.nome_fantasia AS empresa
    FROM contratos_gerados cg
    LEFT JOIN vaga v ON v.id_vaga = cg.vaga
    LEFT JOIN empresa emp ON emp.id_empresa = cg.id_empresa
    WHERE cg.id_candidato = ?
    ORDER BY cg.id_contratogerado DESC
    `,
    [idCandidato]
  );
  return rows.map((row) => ({
    idContrato: String(row.id_contratogerado),
    nome: String(row.nome_contrato || 'Documento'),
    vaga: row.vaga ? String(row.vaga) : null,
    cargo: row.cargo || null,
    empresa: row.empresa || null,
    data: dataBr(row.data) || String(row.data || ''),
    status: Number(row.status) === 1 ? 'Ativo' : 'Inativo',
  }));
}

export async function listarOcorrencias(idCandidato: string): Promise<OcorrenciaCandidato[]> {
  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT id_ocorrencia, descricao, data, data_adicao
    FROM ocorrencias
    WHERE id_candidato = ?
    ORDER BY id_ocorrencia DESC
    `,
    [idCandidato]
  );
  return rows.map((row) => ({
    id: String(row.id_ocorrencia),
    descricao: String(row.descricao || ''),
    data: dataBr(row.data) || dataBr(row.data_adicao) || String(row.data || ''),
  }));
}

export async function getTextoContrato(idContrato: string): Promise<{ html: string; nome: string } | null> {
  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT cg.nome_contrato, tc.texto
    FROM contratos_gerados cg
    LEFT JOIN texto_contrato tc ON tc.id_contratogerado = cg.id_contratogerado
    WHERE cg.id_contratogerado = ?
    LIMIT 1
    `,
    [idContrato]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    nome: String(row.nome_contrato || 'Documento'),
    html: String(row.texto || ''),
  };
}

export async function jaDemitido(
  conn: PoolConnection,
  idCandidato: string,
  idVaga: string
): Promise<boolean> {
  const [rows] = await conn.query<DnaRow[]>(
    `SELECT id_candidato FROM demissao WHERE id_candidato = ? AND id_vaga = ? LIMIT 1`,
    [idCandidato, idVaga]
  );
  return rows.length > 0;
}

export async function insertId(conn: PoolConnection, sql: string, params: unknown[]): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(sql, params);
  return Number(result.insertId);
}
