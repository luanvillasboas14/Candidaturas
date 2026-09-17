import { crmRequest } from '@/lib/crm-dna';
import { firstHumanCampaign } from './campaign-label';

export interface ContactTracking {
  origem: string | null;
  campanha: string | null;
  headline: string | null;
  ctwa_clid: string | null;
  fbclid: string | null;
  gclid: string | null;
  referrer: string | null;
}

export interface ContactTrackingRecord extends ContactTracking {
  telefone: string;
}

interface CrmContactTracking {
  id?: string;
  phone?: string | null;
  source?: string | null;
  referrer?: string | null;
  utmReferrer?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  adUtmSource?: string | null;
  adUtmCampaign?: string | null;
  adHeadline?: string | null;
  adCtwaClid?: string | null;
  adSourceId?: string | null;
  adResolvedCampaignName?: string | null;
  adResolvedName?: string | null;
  ttadId?: string | null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function detectOrigem(input: {
  referrer?: string | null;
  source?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  ttadId?: string | null;
  adUtmSource?: string | null;
}): string | null {
  const blob = [input.referrer, input.source, input.adUtmSource]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (blob.includes('instagram')) return 'instagram';
  if (blob.includes('facebook') || blob.includes('fb.me') || blob.includes('fb.com') || input.fbclid) {
    return 'facebook';
  }
  if (blob.includes('google') || blob.includes('gclid') || input.gclid) return 'google';
  if (blob.includes('tiktok') || input.ttadId) return 'tiktok';
  if (blob.includes('whatsapp')) return 'whatsapp';
  return text(input.source);
}

function toTracking(contact: CrmContactTracking): ContactTracking {
  const referrer = text(contact.referrer) || text(contact.utmReferrer);
  const headline = text(contact.adHeadline) || text(contact.adResolvedName);
  const campanha = firstHumanCampaign(
    text(contact.adResolvedCampaignName),
    headline,
    text(contact.adUtmCampaign)
  );

  return {
    origem: detectOrigem({
      referrer,
      source: contact.source,
      gclid: contact.gclid,
      fbclid: contact.fbclid,
      ttadId: contact.ttadId,
      adUtmSource: contact.adUtmSource,
    }),
    campanha,
    headline,
    ctwa_clid: text(contact.adCtwaClid),
    fbclid: text(contact.fbclid),
    gclid: text(contact.gclid),
    referrer,
  };
}

interface CrmContactsResponse {
  items?: CrmContactTracking[];
}

function withPhone(contact: CrmContactTracking, fallbackPhone?: string | null): ContactTrackingRecord | null {
  const telefone = text(contact.phone) || text(fallbackPhone);
  if (!telefone) return null;
  return { telefone, ...toTracking(contact) };
}

export async function getContactTrackingById(contactId: string): Promise<ContactTrackingRecord | null> {
  const detail = await crmRequest<CrmContactTracking>(`/api/contacts/${contactId}`);
  return withPhone(detail);
}

export async function getContactTrackingByPhone(phone: string): Promise<ContactTrackingRecord | null> {
  const list = await crmRequest<CrmContactsResponse>(
    `/api/contacts?phone=${encodeURIComponent(phone)}&includeTracking=1&perPage=1`
  );
  const summary = list.items?.[0];
  if (!summary?.id) return null;

  try {
    const detail = await crmRequest<CrmContactTracking>(`/api/contacts/${summary.id}`);
    return withPhone({ ...summary, ...detail }, phone);
  } catch (error) {
    console.warn('Não foi possível ler o detalhe de tracking do CRM:', error);
    return withPhone(summary, phone);
  }
}
