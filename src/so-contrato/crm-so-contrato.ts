import { crmRequest } from '@/lib/crm-dna';
import { readEnv } from '@/lib/env';

const STAGE_OK_CONTRATACAO_ID = 'cmusmxgwo14hhmg01qng1pqnf';
const OWNER_KETOLYN_ID = 'cmpd068xn004op8013vwird24';
const TAG_NAME = 'Só contrato';

interface CrmOwner {
  id: string;
  name?: string | null;
}

interface CrmDeal {
  id: string;
  number?: number;
  title?: string;
  stageId?: string;
  owner?: CrmOwner | null;
  ownerId?: string | null;
}

interface CrmContact {
  id: string;
  name?: string | null;
}

interface CrmLeadResponse {
  contact?: CrmContact | null;
  deal?: CrmDeal | null;
  contactCreated?: boolean;
  dealCreated?: boolean;
  dealReused?: boolean;
}

export interface SoContratoResult {
  contactId: string;
  dealId: string;
  dealNumber: number | null;
  createdNewDeal: boolean;
}

function toCrmPhone(digits: string): string {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function stageId(): string {
  return readEnv('CRM_DNA_STAGE_OK_CONTRATACAO_ID').trim() || STAGE_OK_CONTRATACAO_ID;
}

function ketolynId(): string {
  return readEnv('CRM_DNA_OWNER_KETOLYN_ID').trim() || OWNER_KETOLYN_ID;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gravarKetolyn(dealId: string, contactId: string, ownerId: string): Promise<void> {
  await crmRequest(`/api/deals/${dealId}`, {
    method: 'PUT',
    body: JSON.stringify({ ownerId }),
  });
  await crmRequest(`/api/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({ assignedToId: ownerId }),
  });
}

async function garantirKetolyn(dealId: string, contactId: string, ownerId: string): Promise<void> {
  await esperar(1200);
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    await gravarKetolyn(dealId, contactId, ownerId);
    await esperar(800);
    const atual = await crmRequest<CrmDeal>(`/api/deals/${dealId}`);
    if ((atual.ownerId || atual.owner?.id) === ownerId) return;
  }
  throw new Error('O responsável não ficou com a Ketolyn.');
}

async function addSoContratoTag(dealId: string): Promise<void> {
  await crmRequest(`/api/deals/${dealId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagName: TAG_NAME }),
  });
}

export async function createSoContratoDeal(input: {
  name: string;
  phoneDigits: string;
  photoName: string;
  ownerId?: string | null;
}): Promise<SoContratoResult> {
  const ownerId = input.ownerId || ketolynId();
  const lead = await crmRequest<CrmLeadResponse>('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      contact: {
        name: input.name,
        phone: toCrmPhone(input.phoneDigits),
        source: TAG_NAME,
        assignedToId: ownerId || undefined,
      },
      deal: {
        title: input.name,
        stageId: stageId(),
        ownerId: ownerId || undefined,
        value: 0,
      },
      options: {
        reuseOpenDeal: true,
        fillEmptyContactFieldsOnly: true,
      },
    }),
  });

  const deal = lead.deal;
  const contact = lead.contact;
  if (!deal?.id || !contact?.id) {
    throw new Error('O CRM não devolveu o negócio criado.');
  }

  const destino = stageId();
  if (deal.stageId !== destino) {
    await crmRequest(`/api/deals/${deal.id}`, {
      method: 'PUT',
      body: JSON.stringify({ stageId: destino }),
    }).catch((error) => {
      console.warn('Não foi possível ajustar a fase do negócio:', error);
    });
  }

  await addSoContratoTag(deal.id);
  await garantirKetolyn(deal.id, contact.id, ownerId);

  return {
    contactId: contact.id,
    dealId: deal.id,
    dealNumber: deal.number ?? null,
    createdNewDeal: Boolean(lead.dealCreated),
  };
}

export async function createSoContratoDeals(input: {
  people: { name: string; phoneDigits: string }[];
  photoName: string;
}): Promise<SoContratoResult[]> {
  const ownerId = ketolynId();

  const results: SoContratoResult[] = [];
  for (const person of input.people) {
    results.push(
      await createSoContratoDeal({
        name: person.name,
        phoneDigits: person.phoneDigits,
        photoName: input.photoName,
        ownerId,
      })
    );
  }

  return results;
}
