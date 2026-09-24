import { readEnv } from '@/lib/env';
import { getDnaWorkPool, withDnaWorkTransaction, type DnaRow } from '@/lib/dna-work-db';
import { montarDocumentoRecisao } from './documento';
import { dataBanco, jaDemitido } from './queries';
import {
  AVALIACOES_DESEMPENHO,
  MOTIVOS_DEMISSAO,
  NOME_DOCUMENTO_RESCISAO,
  type AvaliacaoDesempenho,
  type MotivoDemissao,
} from './types';

function hojeIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function operador(): string {
  return readEnv('DNA_WORK_OPERATOR_USER').trim() || 'sistema-novo';
}

function validarDemissao(input: {
  motivo: string;
  dataDemissao: string;
  avaliacao: string;
  resumoAtividades: string;
}) {
  if (!MOTIVOS_DEMISSAO.includes(input.motivo as MotivoDemissao)) {
    throw new Error('Motivo da demissão inválido.');
  }
  if (!AVALIACOES_DESEMPENHO.includes(input.avaliacao as AvaliacaoDesempenho)) {
    throw new Error('Avaliação de desempenho inválida.');
  }
  if (!input.resumoAtividades.trim()) {
    throw new Error('Resumo das atividades é obrigatório.');
  }
  const dataFim = dataBanco(input.dataDemissao);
  if (!dataFim) throw new Error('Data de demissão inválida.');
  return dataFim;
}

function camposDocumento(input: {
  idCandidato: string;
  idVaga: string;
  motivo: string;
  dataDemissao: string;
  avaliacao: string;
  resumoAtividades: string;
}) {
  return {
    idCandidato: input.idCandidato,
    idVaga: input.idVaga,
    motivo: input.motivo,
    dataDemissao: input.dataDemissao,
    avaliacao: input.avaliacao as AvaliacaoDesempenho,
    resumoAtividades: input.resumoAtividades.trim(),
  };
}

export async function preverDocumento(input: {
  idCandidato: string;
  idVaga: string;
  motivo: string;
  dataDemissao: string;
  avaliacao: string;
  resumoAtividades: string;
}): Promise<{ html: string }> {
  validarDemissao(input);
  const conn = await getDnaWorkPool().getConnection();
  try {
    const doc = await montarDocumentoRecisao(conn, camposDocumento(input));
    return { html: doc.html };
  } finally {
    conn.release();
  }
}

export async function demitirCandidato(input: {
  idCandidato: string;
  idVaga: string;
  motivo: string;
  dataDemissao: string;
  motivoInterno: string;
  avaliacao: string;
  resumoAtividades: string;
  previu?: boolean;
}): Promise<{ idContrato: number; html: string }> {
  const dataFim = validarDemissao(input);

  return withDnaWorkTransaction(async (conn) => {
    if (await jaDemitido(conn, input.idCandidato, input.idVaga)) {
      throw new Error('Candidato já demitido nesta vaga.');
    }

    const [cvRows] = await conn.query<DnaRow[]>(
      `SELECT * FROM conratacaovaga WHERE id_candidato = ? AND id_vaga = ? AND status = 1 LIMIT 1`,
      [input.idCandidato, input.idVaga]
    );
    const cv = cvRows[0];
    if (!cv) throw new Error('Não há contratação ativa.');

    const [vagaRows] = await conn.query<DnaRow[]>(
      `SELECT comparador, id_empresa, tipo_vaga FROM vaga WHERE id_vaga = ? LIMIT 1`,
      [input.idVaga]
    );
    const vaga = vagaRows[0];
    if (!vaga) throw new Error('Vaga não encontrada.');

    const doc = await montarDocumentoRecisao(conn, camposDocumento(input));

    const hoje = dataBanco(hojeIso());
    const user = operador();

    const [modeloRows] = await conn.query<DnaRow[]>(
      `SELECT id_contrato FROM contratos_diversos WHERE nome = ? LIMIT 1`,
      [NOME_DOCUMENTO_RESCISAO]
    );

    const [insertGerado] = await conn.query(
      `
      INSERT INTO contratos_gerados
        (id_contrato, id_empresa, id_candidato, nome_contrato, status, data, vaga, datainicio, datafim, id_usuario, chave)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, UUID())
      `,
      [
        modeloRows[0]?.id_contrato ?? null,
        vaga.id_empresa,
        input.idCandidato,
        NOME_DOCUMENTO_RESCISAO,
        hoje,
        input.idVaga,
        dataBanco(cv.datainicio),
        dataFim,
        user,
      ]
    );
    const idNovo = Number((insertGerado as { insertId: number }).insertId);
    if (!idNovo) throw new Error('Falha ao gravar o contrato gerado.');

    await conn.query(`INSERT INTO texto_contrato (id_contratogerado, texto) VALUES (?, ?)`, [
      idNovo,
      doc.html,
    ]);

    const dataFimOriginal = cv.datafim;

    await conn.query(
      `UPDATE conratacaovaga SET status = 2, data_demicao = ?, datafim = ? WHERE id_candidato = ? AND id_vaga = ?`,
      [dataFim, dataFim, input.idCandidato, input.idVaga]
    );

    await conn.query(
      `UPDATE contratos_gerados SET status = 0 WHERE id_candidato = ? AND vaga = ? AND status = 1 AND id_contratogerado <> ?`,
      [input.idCandidato, input.idVaga, idNovo]
    );

    await conn.query(
      `
      UPDATE emcaminhamento
      SET reprovado = 'S', feed = 'Demitido'
      WHERE id_candidato = ? AND id_vaga = ? AND (reprovado IS NULL OR reprovado = 'N')
      `,
      [input.idCandidato, input.idVaga]
    );

    await conn.query(`UPDATE vaga SET status = 2 WHERE id_vaga = ?`, [input.idVaga]);

    await conn.query(
      `
      INSERT INTO demissao
        (id_candidato, id_vaga, id_contratos, processa_demissao, comparador, data_fim_original, contratos_demissao, motivo, motivo_interno)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.idCandidato,
        input.idVaga,
        doc.idsContratosAntigos.length ? `${doc.idsContratosAntigos.join(',')},` : '',
        hoje,
        vaga.comparador,
        dataFimOriginal,
        `${idNovo},`,
        input.motivo,
        input.motivoInterno || '',
      ]
    );

    const textoOcorrencia = `Demissão. Motivo: ${input.motivo}. ${input.motivoInterno || ''}`.trim();
    await conn.query(
      `INSERT INTO ocorrencias (id_candidato, descricao, nivel, data, id_usuario) VALUES (?, ?, 1, ?, NULL)`,
      [input.idCandidato, textoOcorrencia, hoje]
    );
    if (vaga.id_empresa) {
      await conn.query(
        `INSERT INTO ocorrencias_empresa (id_empresa, descricao, nivel, data, id_usuario) VALUES (?, ?, 1, ?, NULL)`,
        [vaga.id_empresa, textoOcorrencia, hoje]
      );
    }

    await conn.query(
      `
      INSERT INTO log_diversos (usuario, id_empresa, id_candidato, id_vaga, data, acao)
      VALUES (?, ?, ?, ?, NOW(), 'Demissão')
      `,
      [user, vaga.id_empresa, input.idCandidato, input.idVaga]
    );

    return { idContrato: idNovo, html: doc.html };
  });
}
