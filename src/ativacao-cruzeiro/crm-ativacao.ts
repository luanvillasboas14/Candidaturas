import { crmRequest } from '@/lib/crm-dna';
import { normalizePhone } from '@/lib/phone';
import { listJobs } from '@/lib/supabase';
import { upsertTrackerLead } from '@/lib/supabase-server';

const PIPELINE_PRINCIPAL = 'cmodk1kqc0002qp013eranfa2';
const STAGE_ATIVACAO = 'cmstdsc2v04pjk101qb2s0a6q';
const STAGE_PERDIDO = 'cf133884ea761486f9855d93ffa4862a9';
export const TAG_CRUZEIRO = 'Cruzeiro';

export type AlunoLeadCruzeiro = {
  pessoaId: string;
  nome: string;
  email?: string | null;
  telefone: string;
  curso: string;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  dataNasc?: string | null;
  idade?: number | null;
};

type CrmLeadResponse = {
  contact?: { id?: string } | null;
  deal?: { id?: string; number?: number } | null;
};

type CrmDeal = {
  id?: string;
  stageId?: string;
  status?: string;
  updatedAt?: string;
  pipelineId?: string;
  stage?: { id?: string; name?: string; pipelineId?: string; pipeline?: { id?: string } };
};

type CrmDealList = {
  items?: CrmDeal[];
};

type CrmContactList = {
  items?: Array<{ id?: string }>;
};

function titlePt(value: string): string {
  const small = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em']);
  return value
    .toLowerCase()
    .split(/(\s+|—|-)/)
    .map((part, index) => {
      if (!part || /^\s+$/.test(part) || part === '—' || part === '-') return part;
      if (/^cst$/i.test(part)) return 'CST';
      if (small.has(part) && index > 0) return part;
      return part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1);
    })
    .join('');
}

function primeiroNome(nome: string): string {
  return titlePt(nome).split(/\s+/).filter(Boolean)[0] || nome;
}

function dataIso(dataNasc: string | null | undefined): string | null {
  if (!dataNasc) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataNasc)) {
    const [dia, mes, ano] = dataNasc.split('/');
    return `${ano}-${mes}-${dia}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dataNasc)) return dataNasc.slice(0, 10);
  return null;
}

function toCrmPhone(digits: string): string {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function foldLocal(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function localComPreposicao(lugar: string): string {
  const nome = titlePt(lugar.trim());
  if (!nome) return '';
  const fold = foldLocal(nome);

  if (/^as\s/.test(fold)) return `nas ${nome}`;
  if (/^os\s/.test(fold)) return `nos ${nome}`;
  if (/^a\s/.test(fold)) return `na ${nome}`;
  if (/^o\s/.test(fold)) return `no ${nome}`;

  if (
    /^(vila|praca|chacara|fazenda|cidade|ilha|serra|barra|casa|agua|ponte|quinta|granja|estancia|peninsula|lapa|mooca|penha|saude|liberdade|consolacao|republica|se|freguesia|bela vista|santa)\b/.test(
      fold
    )
  ) {
    return `na ${nome}`;
  }

  if (
    /^(jardim|parque|largo|alto|morro|campo|sitio|recanto|conjunto|nucleo|distrito|centro|bosque|vale|bairro|rio)\b/.test(
      fold
    )
  ) {
    return `no ${nome}`;
  }

  return `em ${nome}`;
}

async function tituloVaga(vagaId: string): Promise<string> {
  const vagas = await listJobs();
  const vaga = vagas.find((item) => item.id === vagaId);
  const cargo = titlePt(vaga?.title || '');
  const bairro = vaga?.bairro || vaga?.location?.split(',')[0] || '';
  if (cargo && bairro) return `${cargo} ${localComPreposicao(bairro)}`;
  return cargo || titlePt(bairro) || TAG_CRUZEIRO;
}

function camposAtivacao(aluno: AlunoLeadCruzeiro, phoneNorm: string, titulo: string) {
  const nomeCompleto = titlePt(aluno.nome);
  const endereco = titlePt([aluno.endereco, aluno.bairro, aluno.cidade].filter(Boolean).join(' — '));
  const curso = titlePt(aluno.curso || '');
  const nascimento = dataIso(aluno.dataNasc);
  return {
    nomeCompleto,
    fields: [
      { name: 'nome_completo', value: nomeCompleto },
      { name: 'endereco', value: endereco },
      { name: 'escolaridade', value: 'ensino médio completo' },
      { name: 'status_escolaridade', value: 'sim' },
      { name: 'data_de_nascimento', value: nascimento },
      { name: 'idade', value: aluno.idade != null ? String(aluno.idade) : '' },
      { name: 'telefone', value: phoneNorm.replace(/^55/, '') },
      { name: 'campanha', value: TAG_CRUZEIRO },
      { name: 'curso', value: curso },
      { name: 'titulovaga1', value: titulo },
    ].filter((field) => field.value),
  };
}

function pipelineDoDeal(deal: CrmDeal): string {
  const fase = faseDoDeal(deal);
  if (fase === STAGE_PERDIDO || fase === STAGE_ATIVACAO) return PIPELINE_PRINCIPAL;
  return deal.stage?.pipelineId || deal.stage?.pipeline?.id || deal.pipelineId || '';
}

function faseDoDeal(deal: CrmDeal): string {
  return deal.stageId || deal.stage?.id || '';
}

async function buscarContatoId(phoneNorm: string): Promise<string | null> {
  const telefones = [toCrmPhone(phoneNorm), phoneNorm, phoneNorm.replace(/^55/, '')];
  for (const phone of telefones) {
    const lista = await crmRequest<CrmContactList>(
      `/api/contacts?phone=${encodeURIComponent(phone)}&perPage=5`
    );
    const id = lista.items?.find((item) => item.id)?.id;
    if (id) return id;
  }
  return null;
}

async function detalharDeal(deal: CrmDeal): Promise<CrmDeal> {
  if (!deal.id) return deal;
  if (pipelineDoDeal(deal) && faseDoDeal(deal)) return deal;
  const cheio = await crmRequest<CrmDeal>(`/api/deals/${deal.id}`).catch(() => null);
  return cheio?.id ? { ...deal, ...cheio } : deal;
}

async function listarNegocios(contactId: string | null, phoneNorm: string): Promise<CrmDeal[]> {
  const vistos = new Map<string, CrmDeal>();
  const local = phoneNorm.replace(/^55/, '');
  const fontes = [
    contactId ? `/api/deals?contactId=${encodeURIComponent(contactId)}&perPage=50` : '',
    contactId ? `/api/deals?contactId=${encodeURIComponent(contactId)}&status=LOST&perPage=50` : '',
    `/api/deals?contactPhone=${encodeURIComponent(phoneNorm)}&perPage=50`,
    `/api/deals?search=${encodeURIComponent(local)}&perPage=20`,
    `/api/deals?stageId=${encodeURIComponent(STAGE_PERDIDO)}&search=${encodeURIComponent(local)}&perPage=20`,
  ].filter(Boolean);

  for (const path of fontes) {
    const lista = await crmRequest<CrmDealList>(path).catch(() => ({ items: [] }));
    for (const deal of lista.items || []) {
      if (deal.id) vistos.set(deal.id, deal);
    }
  }

  return Promise.all([...vistos.values()].map((deal) => detalharDeal(deal)));
}

function ehPerdido(deal: CrmDeal): boolean {
  if (faseDoDeal(deal) === STAGE_PERDIDO) return true;
  const nome = foldLocal(deal.stage?.name || '');
  return nome === 'perdido' || deal.status === 'LOST';
}

function decidirAcao(deals: CrmDeal[]): { acao: 'criar' | 'perdido' | 'ignorar'; deal?: CrmDeal } {
  const principais = deals.filter((deal) => pipelineDoDeal(deal) === PIPELINE_PRINCIPAL);
  if (principais.length) {
    const ativos = principais.filter((deal) => !ehPerdido(deal));
    if (ativos.length) return { acao: 'ignorar' };
    const perdidos = principais
      .filter((deal) => ehPerdido(deal))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return { acao: 'perdido', deal: perdidos[0] };
  }
  if (deals.length) return { acao: 'ignorar' };
  return { acao: 'criar' };
}

type CrmFieldDef = { id?: string; name?: string; label?: string };

let camposDealCache: Promise<Map<string, string>> | null = null;

async function mapaCamposDeal(): Promise<Map<string, string>> {
  if (!camposDealCache) {
    camposDealCache = crmRequest<CrmFieldDef[] | { items?: CrmFieldDef[] }>('/api/custom-fields?entity=deal')
      .then((res) => {
        const lista = Array.isArray(res) ? res : res.items || [];
        const mapa = new Map<string, string>();
        for (const campo of lista) {
          if (!campo.id) continue;
          const chaves = [campo.name, campo.label].filter(Boolean) as string[];
          for (const chave of chaves) mapa.set(foldLocal(chave), campo.id);
        }
        return mapa;
      })
      .catch((error) => {
        camposDealCache = null;
        throw error;
      });
  }
  return camposDealCache;
}

async function gravarCamposDeal(dealId: string, fields: Array<{ name: string; value: string }>) {
  const mapa = await mapaCamposDeal();
  const values = fields
    .map((field) => {
      const fieldId = mapa.get(foldLocal(field.name));
      return fieldId ? { fieldId, value: field.value } : null;
    })
    .filter((item): item is { fieldId: string; value: string } => Boolean(item));
  if (!values.length) return;
  await crmRequest(`/api/deals/${dealId}/custom-fields`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
}

async function reativarPerdido(dealId: string, fields: Array<{ name: string; value: string }>) {
  await gravarCamposDeal(dealId, fields);
  await crmRequest(`/api/deals/${dealId}`, {
    method: 'PUT',
    body: JSON.stringify({
      stageId: STAGE_ATIVACAO,
      status: 'OPEN',
    }),
  });
  await crmRequest(`/api/deals/${dealId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagName: TAG_CRUZEIRO }),
  });
}

async function gravarTracker(phoneNorm: string, titulo: string) {
  await upsertTrackerLead({
    telefone: toCrmPhone(phoneNorm),
    telefone_normalizado: phoneNorm,
    origem: TAG_CRUZEIRO,
    campanha: TAG_CRUZEIRO,
    headline: titulo,
    ctwa_clid: null,
    fbclid: null,
    gclid: null,
    referrer: null,
  });
}

export async function criarLeadCruzeiro(
  aluno: AlunoLeadCruzeiro,
  vagaId: string,
  tituloVaga1?: string
): Promise<{ acao: 'criado' | 'perdido' | 'ignorado' }> {
  const phoneNorm = normalizePhone(aluno.telefone);
  if (!phoneNorm) throw new Error('Telefone inválido.');

  const titulo = tituloVaga1 || (await tituloVaga(vagaId));
  const { nomeCompleto, fields } = camposAtivacao(aluno, phoneNorm, titulo);
  const contactId = await buscarContatoId(phoneNorm);
  const deals = await listarNegocios(contactId, phoneNorm);
  const decisao = decidirAcao(deals);

  if (decisao.acao === 'ignorar') return { acao: 'ignorado' };

  if (decisao.acao === 'perdido') {
    if (!decisao.deal?.id) return { acao: 'ignorado' };
    await reativarPerdido(decisao.deal.id, fields);
    await gravarTracker(phoneNorm, titulo);
    return { acao: 'perdido' };
  }

  const lead = await crmRequest<CrmLeadResponse>('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      contact: {
        name: primeiroNome(aluno.nome),
        phone: toCrmPhone(phoneNorm),
        email: aluno.email || undefined,
        source: TAG_CRUZEIRO,
      },
      deal: {
        title: nomeCompleto,
        stageId: STAGE_ATIVACAO,
        value: 0,
        customFields: fields,
      },
      options: {
        reuseOpenDeal: false,
        fillEmptyContactFieldsOnly: false,
      },
    }),
  });

  if (!lead.deal?.id) throw new Error('O CRM não devolveu o negócio.');
  await crmRequest(`/api/deals/${lead.deal.id}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagName: TAG_CRUZEIRO }),
  });
  await gravarTracker(phoneNorm, titulo);
  return { acao: 'criado' };
}

export async function criarLeadsCruzeiro(
  alunos: AlunoLeadCruzeiro[],
  vagaId: string
): Promise<{ criados: number; atualizados: number; pulados: number; falhas: string[]; okIds: string[] }> {
  const titulo = await tituloVaga(vagaId);
  const falhas: string[] = [];
  const okIds: string[] = [];
  let criados = 0;
  let atualizados = 0;
  let pulados = 0;
  for (const aluno of alunos) {
    try {
      const resultado = await criarLeadCruzeiro(aluno, vagaId, titulo);
      if (resultado.acao === 'ignorado') {
        pulados += 1;
        continue;
      }
      okIds.push(aluno.pessoaId);
      if (resultado.acao === 'criado') criados += 1;
      else atualizados += 1;
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : 'falha no CRM';
      falhas.push(`${aluno.nome}: ${detalhe}`);
    }
  }
  return { criados, atualizados, pulados, falhas, okIds };
}
