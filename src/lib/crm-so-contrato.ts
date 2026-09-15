import { readEnv } from './env';
import { crmRequest } from './crm-dna';

const STAGE_OK_CONTRATACAO_ID = 'cmplhpr8z0021qn012ni60tri';
const TAG_NAME = 'Só contrato';
const OWNER_NAME = 'Ketolyn';

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

interface CrmDealList {
  items?: CrmDeal[];
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

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toCrmPhone(digits: string): string {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function isKetolyn(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = fold(name);
  return n.includes('ketolyn') || n.includes('ketly');
}

function stageId(): string {
  return readEnv('CRM_DNA_STAGE_OK_CONTRATACAO_ID').trim() || STAGE_OK_CONTRATACAO_ID;
}

async function resolveOwnerId(): Promise<string | null> {
  const fromEnv = readEnv('CRM_DNA_OWNER_KETOLYN_ID').trim();
  if (fromEnv) return fromEnv;

  const inStage = await crmRequest<CrmDealList>(
    `/api/deals?stageId=${encodeURIComponent(stageId())}&perPage=50`
  );
  const fromStage = (inStage.items || []).find((deal) => isKetolyn(deal.owner?.name));
  return fromStage?.owner?.id || null;
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
  const ownerId = input.ownerId === undefined ? await resolveOwnerId() : input.ownerId;
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

  if (ownerId && deal.ownerId !== ownerId) {
    await crmRequest(`/api/deals/${deal.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ownerId, stageId: stageId() }),
    }).catch((error) => {
      console.warn('Não foi possível ajustar responsável/fase do negócio:', error);
    });
  }

  await addSoContratoTag(deal.id);

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
  const ownerId = await resolveOwnerId().catch((error) => {
    console.warn('Não foi possível resolver a Ketolyn no CRM:', error);
    return null;
  });

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
