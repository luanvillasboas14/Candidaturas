import { getDnaWorkPool, withDnaWorkTransaction, type DnaRow } from '@/lib/dna-work-db';
import {
  extrairPdfBase64,
  zapsignAgenteId,
  zapsignAssinarLote,
  zapsignCriarDoc,
  zapsignDetalharDoc,
  zapsignReenviarEmail,
  zapsignUserToken,
  type ZapDoc,
  type ZapSignerIn,
} from '@/lib/zapsign';
import { dataBanco, dataBr, dataIso, insertId } from './queries';
import { NOME_DOCUMENTO_RESCISAO, type EnvelopeTela } from './types';

export type DocumentoTela = {
  idContrato: string;
  nome: string;
  html: string;
  candidato: string;
  empresa: string;
  cargo: string;
  dataDemissao: string;
  envelope: EnvelopeTela | null;
};

type SignerDraft = {
  papel: string;
  nome: string;
  email: string;
  externalId: string;
  sendEmail: boolean;
  authMode: 'tokenEmail' | 'assinaturaTela';
};

function texto(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function pastaCandidato(nome: string): string {
  const limpo = nome.replace(/[\\/]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
  return `/dna-work/${limpo || 'candidato'}/`;
}

function idadeAnos(raw: string | null | undefined): number | null {
  const iso = dataIso(raw);
  if (!iso) return null;
  const nasc = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade -= 1;
  return idade;
}

function nomeResponsavel(cand: DnaRow): string {
  const tipo = texto(cand.responsavel);
  if (tipo === 'PA') return texto(cand.nomepai);
  if (tipo === 'M') return texto(cand.nomemae);
  if (tipo === 'O') return texto(cand.nome_responsavel);
  return '';
}

function papelDe(tipoPessoa: string): string {
  if (tipoPessoa.startsWith('candidato=')) return 'Estagiário';
  if (tipoPessoa.startsWith('responsavel-candidato=')) return 'Responsável legal';
  if (tipoPessoa.startsWith('supervidor=')) return 'Supervisor da empresa';
  if (tipoPessoa.startsWith('empresa=')) return 'Empresa';
  if (tipoPessoa.startsWith('escola-diretor=')) return 'Diretor da escola';
  if (tipoPessoa.startsWith('escola-representante=')) return 'Representante da escola';
  if (tipoPessoa.startsWith('escola-supervisor=')) return 'Supervisor da escola';
  if (tipoPessoa.startsWith('agente=')) return 'DNA Work';
  return tipoPessoa;
}

function ehDna(tipoPessoa: string): boolean {
  return tipoPessoa.startsWith('agente=');
}

export class AssinaturaErro extends Error {
  faltando: string[];
  constructor(faltando: string[]) {
    super(faltando.join(' '));
    this.name = 'AssinaturaErro';
    this.faltando = faltando;
  }
}

async function carregarContrato(idContrato: string) {
  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT
      cg.id_contratogerado, cg.nome_contrato, cg.datafim, cg.id_candidato, cg.vaga, cg.id_empresa,
      tc.texto, c.nome AS candidato, emp.nome_fantasia AS empresa, v.cargo
    FROM contratos_gerados cg
    LEFT JOIN texto_contrato tc ON tc.id_contratogerado = cg.id_contratogerado
    LEFT JOIN candidato c ON c.id_candidato = cg.id_candidato
    LEFT JOIN empresa emp ON emp.id_empresa = cg.id_empresa
    LEFT JOIN vaga v ON v.id_vaga = cg.vaga
    WHERE cg.id_contratogerado = ?
    LIMIT 1
    `,
    [idContrato]
  );
  return rows[0] || null;
}

async function carregarEnvelope(idContrato: string): Promise<EnvelopeTela | null> {
  const [docs] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT * FROM assinatura_digital WHERE id_contratogerado = ? ORDER BY id DESC LIMIT 1`,
    [idContrato]
  );
  const doc = docs[0];
  if (!doc) return null;
  const [assinantes] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT * FROM assinatura_digital_assinantes WHERE id_assinatura = ? ORDER BY id`,
    [doc.id]
  );
  const avisoDna = assinantes.some((item) => ehDna(texto(item.tipo_pessoa)) && texto(item.status) !== 'signed')
    ? 'Assinatura automática da DNA ainda não configurada. O envelope já foi enviado para as outras partes.'
    : null;
  return {
    statusDoc: texto(doc.status_doc) || 'pending',
    linkDoc: texto(doc.link_doc) || null,
    dataEnvio: texto(doc.data_envio) || null,
    avisoDna,
    assinantes: assinantes.map((item) => {
      const tipo = texto(item.tipo_pessoa);
      const status = texto(item.status) || 'new';
      return {
        papel: papelDe(tipo),
        nome: ehDna(tipo) ? 'DNA Work' : texto(item.nome),
        email: texto(item.email),
        status,
        data: texto(item.data) || null,
        token: texto(item.token),
        tipoPessoa: tipo,
        podeReenviar: !ehDna(tipo) && status !== 'signed' && Boolean(texto(item.token)),
      };
    }),
  };
}

export async function getDocumentoTela(idContrato: string): Promise<DocumentoTela | null> {
  const row = await carregarContrato(idContrato);
  if (!row) return null;
  return {
    idContrato: String(row.id_contratogerado),
    nome: texto(row.nome_contrato) || NOME_DOCUMENTO_RESCISAO,
    html: String(row.texto || ''),
    candidato: texto(row.candidato),
    empresa: texto(row.empresa),
    cargo: texto(row.cargo),
    dataDemissao: dataBr(row.datafim) || texto(row.datafim),
    envelope: await carregarEnvelope(idContrato),
  };
}

async function montarSigners(idCandidato: string, idVaga: string): Promise<SignerDraft[]> {
  const pool = getDnaWorkPool();
  const [candRows] = await pool.query<DnaRow[]>(`SELECT * FROM candidato WHERE id_candidato = ? LIMIT 1`, [
    idCandidato,
  ]);
  const cand = candRows[0];
  if (!cand) throw new AssinaturaErro(['Candidato não encontrado.']);

  const [cvRows] = await pool.query<DnaRow[]>(
    `SELECT * FROM conratacaovaga WHERE id_candidato = ? AND id_vaga = ? ORDER BY id_contratacao DESC LIMIT 1`,
    [idCandidato, idVaga]
  );
  const cv = cvRows[0] || {};
  const [vagaRows] = await pool.query<DnaRow[]>(`SELECT * FROM vaga WHERE id_vaga = ? LIMIT 1`, [idVaga]);
  const vaga = vagaRows[0] || {};
  const [empRows] = await pool.query<DnaRow[]>(`SELECT * FROM empresa WHERE id_empresa = ? LIMIT 1`, [
    vaga.id_empresa || cv.id_empresa,
  ]);
  const emp = empRows[0] || {};

  const faltando: string[] = [];
  const drafts: SignerDraft[] = [];

  const nomeCand = texto(cand.nome);
  const emailCand = texto(cand.email);
  if (!nomeCand) faltando.push('Nome do candidato está em branco.');
  if (!emailOk(emailCand)) faltando.push('E-mail do candidato está em branco.');
  drafts.push({
    papel: 'Estagiário',
    nome: nomeCand,
    email: emailCand,
    externalId: `candidato=${cand.id_candidato}`,
    sendEmail: true,
    authMode: 'tokenEmail',
  });

  const idade = idadeAnos(cand.datanascimento);
  const precisaResp = idade != null ? idade < 18 : texto(cand.responsavel) !== 'P' && Boolean(texto(cand.responsavel));
  if (precisaResp) {
    if (texto(cand.responsavel) === 'P') {
      faltando.push('Responsável legal do menor não está cadastrado.');
    } else {
      const nomeResp = nomeResponsavel(cand);
      const emailResp = texto(cand.email_responsavel);
      if (!nomeResp) faltando.push('Nome do responsável legal está em branco.');
      if (!emailOk(emailResp)) faltando.push('E-mail do responsável legal está em branco.');
      drafts.push({
        papel: 'Responsável legal',
        nome: nomeResp,
        email: emailResp,
        externalId: `responsavel-candidato=${cand.id_candidato}`,
        sendEmail: true,
        authMode: 'tokenEmail',
      });
    }
  }

  if (emp.id_empresa) {
    const [flagsRows] = await pool.query<DnaRow[]>(
      `SELECT * FROM assinaturas_empresa WHERE id_empresa = ? AND tipo = 'TCE' LIMIT 1`,
      [emp.id_empresa]
    );
    const flags = flagsRows[0];
    const addEmpresa = (ligado: unknown, nome: string, email: string, externalId: string, papel: string) => {
      if (Number(ligado) !== 1) return;
      if (!nome) faltando.push(`Nome de ${papel} da empresa está em branco.`);
      if (!emailOk(email)) faltando.push(`E-mail de ${papel} da empresa está em branco.`);
      drafts.push({
        papel,
        nome,
        email,
        externalId,
        sendEmail: true,
        authMode: 'tokenEmail',
      });
    };
    addEmpresa(1, texto(emp.responsavel), texto(emp.email), `empresa=${emp.id_empresa}`, 'Empresa');
    if (flags) {
      addEmpresa(
        flags.financeiro,
        texto(emp.nome_financeiro),
        texto(emp.email_financeiro),
        `empresa-financeiro=${emp.id_empresa}`,
        'financeiro'
      );
      addEmpresa(
        flags.administrativo,
        texto(emp.nome_administrativo),
        texto(emp.email_administrativo),
        `empresa-administrativo=${emp.id_empresa}`,
        'administrativo'
      );
      addEmpresa(flags.rh, texto(emp.nome_rh), texto(emp.email_rh), `empresa-rh=${emp.id_empresa}`, 'RH');
      if (Number(flags.supervisor) === 1) {
        const [supRows] = cv.id_supervisor
          ? await pool.query<DnaRow[]>(`SELECT * FROM supervisor_estagio WHERE id = ? LIMIT 1`, [cv.id_supervisor])
          : [[]];
        const sup = supRows[0] || {};
        addEmpresa(
          1,
          texto(sup.nome) || texto(emp.supervisor),
          texto(sup.email),
          `supervidor=${cv.id_supervisor || sup.id || emp.id_empresa}`,
          'supervisor'
        );
      }
    }
  }

  const [escRows] = cand.escola
    ? await pool.query<DnaRow[]>(`SELECT * FROM instituicao WHERE id_instiduicao = ? LIMIT 1`, [cand.escola])
    : [[]];
  const escola = escRows[0];
  if (escola) {
    const [escFlagsRows] = await pool.query<DnaRow[]>(
      `SELECT * FROM assinaturas_instituicao WHERE id_instituicao = ? AND tipo = 'TCE' LIMIT 1`,
      [escola.id_instiduicao]
    );
    const escFlags = escFlagsRows[0];
    const addEscola = (ligado: unknown, nome: string, email: string, externalId: string, papel: string) => {
      if (Number(ligado) !== 1) return;
      if (!nome) faltando.push(`Nome do ${papel} da escola está em branco.`);
      if (!emailOk(email)) faltando.push(`E-mail do ${papel} da escola está em branco.`);
      drafts.push({
        papel,
        nome,
        email,
        externalId,
        sendEmail: true,
        authMode: 'tokenEmail',
      });
    };
    addEscola(
      1,
      texto(escola.responsavel),
      texto(escola.responsavel_email) || texto(escola.email),
      `escola-diretor=${escola.id_instiduicao}`,
      'diretor'
    );
    if (escFlags) {
      addEscola(
        escFlags.representante,
        texto(escola.representante_legal),
        texto(escola.representante_legal_email),
        `escola-representante=${escola.id_instiduicao}`,
        'representante'
      );
      addEscola(
        escFlags.supervisor,
        texto(escola.supervisor),
        texto(escola.email),
        `escola-supervisor=${escola.id_instiduicao}`,
        'supervisor'
      );
    }
  }

  drafts.push({
    papel: 'DNA Work',
    nome: 'DNA Work',
    email: '',
    externalId: `agente=${zapsignAgenteId()}`,
    sendEmail: false,
    authMode: 'assinaturaTela',
  });

  if (faltando.length) throw new AssinaturaErro(faltando);

  const vistos = new Set<string>();
  const unicos: SignerDraft[] = [];
  const prioridade = (item: SignerDraft) =>
    item.externalId.startsWith('candidato=') || item.externalId.startsWith('responsavel-candidato=');
  const ordenados = [...drafts.filter(prioridade), ...drafts.filter((item) => !prioridade(item))];
  for (const item of ordenados) {
    if (item.sendEmail) {
      const chave = item.email.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
    }
    unicos.push(item);
  }
  return unicos;
}

function paraZap(signers: SignerDraft[]): ZapSignerIn[] {
  return signers.map((item) => ({
    name: item.nome,
    email: item.sendEmail ? item.email : '',
    auth_mode: item.authMode,
    send_automatic_email: item.sendEmail,
    external_id: item.externalId,
    blank_email: item.sendEmail ? undefined : true,
  }));
}

async function gravarEnvelope(idContrato: number, nomeDoc: string, sede: string, zap: ZapDoc): Promise<void> {
  await withDnaWorkTransaction(async (conn) => {
    const idAssinatura = await insertId(
      conn,
      `
      INSERT INTO assinatura_digital
        (id_contratogerado, status_doc, link_doc, data_envio, token_documento, usuario_adm, nome_doc, doc_sede)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        idContrato,
        zap.status || 'pending',
        zap.original_file || zap.signed_file || '',
        dataBanco(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })),
        zap.token || '',
        Number(zapsignAgenteId()) || 127,
        nomeDoc,
        sede,
      ]
    );
    for (const signer of zap.signers || []) {
      await conn.query(
        `
        INSERT INTO assinatura_digital_assinantes
          (id_assinatura, tipo_pessoa, status, token, nome, email)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          idAssinatura,
          signer.external_id || '',
          signer.status || 'new',
          signer.token || '',
          signer.name || '',
          signer.email || '',
        ]
      );
    }
  });
}

export async function enviarAssinatura(
  idContrato: string,
  pdfBase64: string
): Promise<{ envelope: EnvelopeTela; avisoDna: string | null }> {
  let pdf = '';
  try {
    pdf = extrairPdfBase64(pdfBase64);
  } catch (error) {
    throw new AssinaturaErro([error instanceof Error ? error.message : 'PDF do documento não foi gerado.']);
  }

  const [ja] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT id FROM assinatura_digital WHERE id_contratogerado = ? LIMIT 1`,
    [idContrato]
  );
  if (ja[0]) throw new AssinaturaErro(['Já existe um envio para este documento.']);

  const contrato = await carregarContrato(idContrato);
  if (!contrato) throw new AssinaturaErro(['Documento não encontrado.']);
  const idCandidato = texto(contrato.id_candidato);
  const idVaga = texto(contrato.vaga);
  if (!idCandidato || !idVaga) throw new AssinaturaErro(['Documento sem candidato ou vaga.']);

  const signers = await montarSigners(idCandidato, idVaga);
  const agenteId = zapsignAgenteId();
  const zap = await zapsignCriarDoc({
    name: `${texto(contrato.nome_contrato) || NOME_DOCUMENTO_RESCISAO} - ${texto(contrato.candidato)}`,
    base64Pdf: pdf,
    externalId: `${agenteId}+${idContrato}`,
    folderPath: pastaCandidato(texto(contrato.candidato)),
    signers: paraZap(signers),
  });

  const [empRows] = await getDnaWorkPool().query<DnaRow[]>(`SELECT sede FROM empresa WHERE id_empresa = ? LIMIT 1`, [
    contrato.id_empresa,
  ]);
  await gravarEnvelope(
    Number(idContrato),
    texto(contrato.nome_contrato) || NOME_DOCUMENTO_RESCISAO,
    texto(empRows[0]?.sede),
    zap
  );

  const avisoDna = await tentarAssinarDna(zap);

  const envelope = await carregarEnvelope(idContrato);
  if (!envelope) throw new Error('Envelope enviado, mas a gravação local falhou.');
  return { envelope: { ...envelope, avisoDna: avisoDna || envelope.avisoDna }, avisoDna };
}

async function tentarAssinarDna(zap: ZapDoc): Promise<string | null> {
  const userToken = zapsignUserToken();
  const dna = (zap.signers || []).find(
    (item) => texto(item.external_id).startsWith('agente=') && texto(item.status) !== 'signed'
  );
  if (!dna) return null;
  if (!userToken || !dna.token) {
    return 'Assinatura automática da DNA ainda não configurada. O envelope já foi enviado para as outras partes.';
  }
  try {
    await zapsignAssinarLote(userToken, [dna.token]);
    return null;
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : '';
    return detalhe
      ? `A DNA não assinou automaticamente: ${detalhe}`
      : 'Assinatura automática da DNA ainda não configurada. O envelope já foi enviado para as outras partes.';
  }
}

function statusDocDe(zap: ZapDoc): string {
  const status = texto(zap.status).toLowerCase();
  if (status === 'signed') return 'signed';
  if (status.includes('refus') || status.includes('reject') || status === 'canceled') return status;
  return status || 'pending';
}

export async function sincronizarEnvelope(idContrato: string): Promise<EnvelopeTela | null> {
  const [docs] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT * FROM assinatura_digital WHERE id_contratogerado = ? ORDER BY id DESC LIMIT 1`,
    [idContrato]
  );
  const doc = docs[0];
  if (!doc?.token_documento) return carregarEnvelope(idContrato);
  let zap = await zapsignDetalharDoc(String(doc.token_documento));
  const avisoDna = await tentarAssinarDna(zap);
  if (!avisoDna) {
    zap = await zapsignDetalharDoc(String(doc.token_documento));
  }
  await aplicarZapNoBanco(Number(doc.id), zap);
  const envelope = await carregarEnvelope(idContrato);
  if (!envelope) return null;
  return { ...envelope, avisoDna: avisoDna || envelope.avisoDna };
}

export async function aplicarZapNoBanco(idAssinatura: number, zap: ZapDoc): Promise<void> {
  const pool = getDnaWorkPool();
  await pool.query(`UPDATE assinatura_digital SET status_doc = ?, link_doc = ? WHERE id = ?`, [
    statusDocDe(zap),
    zap.signed_file || zap.original_file || '',
    idAssinatura,
  ]);
  for (const signer of zap.signers || []) {
    if (!signer.token) continue;
    await pool.query(
      `UPDATE assinatura_digital_assinantes SET status = ?, data = ?, nome = ?, email = ? WHERE id_assinatura = ? AND token = ?`,
      [
        signer.status || 'new',
        signer.signed_at || null,
        texto(signer.external_id).startsWith('agente=') ? 'DNA Work' : signer.name || '',
        signer.email || '',
        idAssinatura,
        signer.token,
      ]
    );
  }
}

export async function aplicarWebhookZap(payload: ZapDoc & { token?: string }): Promise<void> {
  const token = texto(payload.token);
  if (!token) return;
  const [docs] = await getDnaWorkPool().query<DnaRow[]>(
    `SELECT id FROM assinatura_digital WHERE token_documento = ? LIMIT 1`,
    [token]
  );
  if (!docs[0]) return;
  await aplicarZapNoBanco(Number(docs[0].id), payload);
}

export async function reenviarEmailAssinante(idContrato: string, signerToken: string): Promise<void> {
  const [rows] = await getDnaWorkPool().query<DnaRow[]>(
    `
    SELECT a.tipo_pessoa, a.status
    FROM assinatura_digital_assinantes a
    JOIN assinatura_digital d ON d.id = a.id_assinatura
    WHERE d.id_contratogerado = ? AND a.token = ?
    LIMIT 1
    `,
    [idContrato, signerToken]
  );
  const row = rows[0];
  if (!row) throw new Error('Assinante não encontrado.');
  if (ehDna(texto(row.tipo_pessoa))) throw new Error('A DNA assina via API, sem reenvio de e-mail.');
  if (texto(row.status) === 'signed') throw new Error('Este assinante já assinou.');
  await zapsignReenviarEmail(signerToken);
}
