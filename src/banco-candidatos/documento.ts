import { readFileSync } from 'fs';
import path from 'path';
import type { PoolConnection } from 'mysql2/promise';
import type { DnaRow } from '@/lib/dna-work-db';
import { dataBr } from './queries';
import { AVALIACOES_DESEMPENHO, type AvaliacaoDesempenho } from './types';

function texto(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function juntar(...partes: Array<string | null | undefined>): string {
  return partes.map((parte) => texto(parte)).filter(Boolean).join(', ');
}

function contato(...partes: Array<string | null | undefined>): string {
  return partes.map((parte) => texto(parte)).filter(Boolean).join(' / ');
}

function responsavelLegal(cand: DnaRow): { nome: string; cpf: string; contato: string } {
  const tipo = texto(cand.responsavel);
  if (tipo === 'PA') {
    return {
      nome: texto(cand.nomepai),
      cpf: texto(cand.cpf_responsavel),
      contato: contato(cand.celular_responsavel, cand.email_responsavel),
    };
  }
  if (tipo === 'M') {
    return {
      nome: texto(cand.nomemae),
      cpf: texto(cand.cpf_responsavel),
      contato: contato(cand.celular_responsavel, cand.email_responsavel),
    };
  }
  if (tipo === 'O') {
    return {
      nome: texto(cand.nome_responsavel),
      cpf: texto(cand.cpf_responsavel),
      contato: contato(cand.celular_responsavel, cand.email_responsavel),
    };
  }
  return { nome: '', cpf: '', contato: '' };
}

function substituir(modelo: string, vars: Record<string, string>): string {
  let out = modelo;
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    out = out.split(`{{${key}}}`).join(vars[key] ?? '');
  }
  return out;
}

export async function montarDocumentoRecisao(
  conn: PoolConnection,
  input: {
    idCandidato: string;
    idVaga: string;
    motivo: string;
    dataDemissao: string;
    avaliacao: AvaliacaoDesempenho;
    resumoAtividades: string;
  }
): Promise<{ html: string; numeroContrato: string; idsContratosAntigos: string[] }> {
  if (!AVALIACOES_DESEMPENHO.includes(input.avaliacao)) {
    throw new Error('Avaliação de desempenho inválida.');
  }
  const resumo = texto(input.resumoAtividades);
  if (!resumo) throw new Error('Resumo das atividades é obrigatório.');

  const [candRows] = await conn.query<DnaRow[]>(
    `SELECT * FROM candidato WHERE id_candidato = ? LIMIT 1`,
    [input.idCandidato]
  );
  const cand = candRows[0];
  if (!cand) throw new Error('Candidato não encontrado.');

  const [cvRows] = await conn.query<DnaRow[]>(
    `SELECT * FROM conratacaovaga WHERE id_candidato = ? AND id_vaga = ? AND status = 1 LIMIT 1`,
    [input.idCandidato, input.idVaga]
  );
  const cv = cvRows[0];
  if (!cv) throw new Error('Não há contratação ativa para este candidato e vaga.');

  const [vagaRows] = await conn.query<DnaRow[]>(`SELECT * FROM vaga WHERE id_vaga = ? LIMIT 1`, [input.idVaga]);
  const vaga = vagaRows[0];
  if (!vaga) throw new Error('Vaga não encontrada.');
  if (Number(vaga.tipo_vaga) !== 1) {
    throw new Error('O documento de recisão+realização vale só para estágio.');
  }

  const [empRows] = await conn.query<DnaRow[]>(
    `SELECT * FROM empresa WHERE id_empresa = ? LIMIT 1`,
    [vaga.id_empresa]
  );
  const emp = empRows[0] || {};
  const [escRows] = await conn.query<DnaRow[]>(
    `SELECT * FROM instituicao WHERE id_instiduicao = ? LIMIT 1`,
    [cand.escola]
  );
  const escola = escRows[0] || {};
  const legal = responsavelLegal(cand);

  const [tceRows] = await conn.query<DnaRow[]>(
    `
    SELECT cg.id_contratogerado
    FROM contratos_gerados cg
    JOIN contratos_diversos cd ON cd.id_contrato = cg.id_contrato
    WHERE cg.id_candidato = ? AND cg.vaga = ? AND cg.status = 1 AND cd.padrao = 'contratoestagiao'
    ORDER BY cg.id_contratogerado DESC
    `,
    [input.idCandidato, input.idVaga]
  );
  const [antigosRows] = await conn.query<DnaRow[]>(
    `
    SELECT id_contratogerado
    FROM contratos_gerados
    WHERE id_candidato = ? AND vaga = ? AND status = 1
    `,
    [input.idCandidato, input.idVaga]
  );

  const vars: Record<string, string> = {
    CODIGO_TCE: escapeHtml(texto(tceRows[0]?.id_contratogerado)),
    CONCEDENTE_NOME: escapeHtml(texto(emp.razao_social)),
    CONCEDENTE_ENDERECO: escapeHtml(juntar(emp.logradouro, emp.numero, emp.complemento, emp.bairro)),
    CONCEDENTE_CIDADE: escapeHtml(texto(emp.cidade)),
    CONCEDENTE_UF: escapeHtml(texto(emp.uf)),
    CONCEDENTE_CEP: escapeHtml(texto(emp.cep)),
    CONCEDENTE_CNPJ: escapeHtml(texto(emp.cnpj)),
    CONCEDENTE_EMAIL: escapeHtml(texto(emp.email)),
    EST_NOME: escapeHtml(texto(cand.nome)),
    EST_NASC: escapeHtml(dataBr(cand.datanascimento) || ''),
    EST_CPF: escapeHtml(texto(cand.cpf)),
    EST_RG: escapeHtml(texto(cand.rg)),
    EST_ENDERECO: escapeHtml(juntar(cand.logradouro, cand.numero, cand.complemento, cand.bairro)),
    EST_CEP: escapeHtml(texto(cand.cep)),
    EST_CIDADE: escapeHtml(texto(cand.cidade)),
    EST_UF: escapeHtml(texto(cand.estado)),
    EST_CURSO: escapeHtml(texto(cand.curso)),
    EST_PERIODO_ANO: escapeHtml(texto(cand.ano_escolar || cand.semestre)),
    EST_TURNO: escapeHtml(texto(cand.periodo)),
    EST_CONTATO: escapeHtml(contato(cand.celular, cand.email)),
    RESP_NOME: escapeHtml(legal.nome),
    RESP_NASC: '',
    RESP_CPF: escapeHtml(legal.cpf),
    RESP_RG: '',
    RESP_ENDERECO: '',
    RESP_CEP: '',
    RESP_CIDADE: '',
    RESP_UF: '',
    RESP_CONTATO: escapeHtml(legal.contato),
    TIPO_OBRIGATORIO: '',
    TIPO_NAO_OBRIGATORIO: 'X',
    DATA_INICIO: escapeHtml(dataBr(cv.datainicio) || ''),
    DATA_RESCISAO: escapeHtml(dataBr(input.dataDemissao) || ''),
    INST_NOME: escapeHtml(texto(escola.razao_social)),
    INST_ENDERECO: escapeHtml(juntar(escola.logradouro, escola.numero, escola.complemento, escola.bairro)),
    INST_CIDADE: escapeHtml(texto(escola.cidade)),
    INST_UF: escapeHtml(texto(escola.uf)),
    INST_CEP: escapeHtml(texto(escola.cep)),
    INST_CNPJ: escapeHtml(texto(escola.cnpj)),
    INST_EMAIL: escapeHtml(texto(escola.email)),
    DATA_TCE: escapeHtml(dataBr(cv.datafim) || ''),
    RESUMO_ATIVIDADES: escapeHtml(resumo).replace(/\n/g, '<br>'),
    MOTIVO: escapeHtml(input.motivo),
    AVALIACAO: escapeHtml(input.avaliacao),
    DATA_ASSINATURA: escapeHtml(dataBr(input.dataDemissao) || ''),
  };

  const modelo = readFileSync(path.join(process.cwd(), 'templates', 'recisao-modelo-novo.html'), 'utf8');
  return {
    html: substituir(modelo, vars),
    numeroContrato: texto(tceRows[0]?.id_contratogerado),
    idsContratosAntigos: antigosRows.map((row) => String(row.id_contratogerado)),
  };
}
