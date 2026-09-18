import { firstHumanCampaign } from './campaign-label';
import type { ContactTracking } from './crm-tracking';

export const INFOJOBS_TAG_ID = 'cmrkrdkyh1gytpn01ae77p55q';
export const INFOJOBS_ORIGEM = 'infojobs';

const ADS = new Set(['instagram', 'facebook', 'google', 'tiktok']);

const EMPTY_TRACKING: ContactTracking = {
  origem: null,
  campanha: null,
  headline: null,
  ctwa_clid: null,
  fbclid: null,
  gclid: null,
  referrer: null,
};

export function isInfojobsText(value?: string | null): boolean {
  const blob = (value || '').toLowerCase();
  return blob.includes('infojobs') || blob.includes('pandape') || blob.includes('pandapé');
}

export function canonicalOrigem(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (isInfojobsText(normalized)) return INFOJOBS_ORIGEM;
  if (normalized.includes('instagram')) return 'instagram';
  if (
    normalized.includes('facebook') ||
    normalized.includes('fb.me') ||
    normalized.includes('fb.com')
  ) {
    return 'facebook';
  }
  if (normalized.includes('google') || normalized.includes('gclid')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('whatsapp')) return 'whatsapp';
  return raw;
}

export function isAdsOrigem(origem?: string | null): boolean {
  return ADS.has((origem || '').toLowerCase());
}

export function isInfojobsOrigem(origem?: string | null): boolean {
  return canonicalOrigem(origem) === INFOJOBS_ORIGEM;
}

export function originRank(origem?: string | null): number {
  const canonical = canonicalOrigem(origem);
  if (!canonical) return 0;
  if (isAdsOrigem(canonical)) return 40;
  if (canonical === INFOJOBS_ORIGEM) return 35;
  if (canonical === 'whatsapp') return 10;
  return 20;
}

export function isInfojobsTag(tag: { id?: string | null; name?: string | null } | string): boolean {
  if (typeof tag === 'string') {
    return tag === INFOJOBS_TAG_ID || isInfojobsText(tag);
  }
  return tag.id === INFOJOBS_TAG_ID || isInfojobsText(tag.name);
}

export function parseInfojobsNote(content?: string | null): string | null {
  const text = content?.trim();
  if (!text || !isInfojobsText(text)) return null;

  const vaga = text.match(/vaga:\s*(.+?)(?=\s*\(processo|\s+[—–-]\s*CEP|$)/i)?.[1]?.trim();
  if (vaga) return vaga;

  const processo = text.match(/processo\s+(\d+)/i)?.[1];
  if (processo) return `Infojobs ${processo}`;

  return 'Infojobs';
}

function pickText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function mergeLeadTracking(
  base?: Partial<ContactTracking> | null,
  incoming?: Partial<ContactTracking> | null
): ContactTracking {
  const left: ContactTracking = {
    ...EMPTY_TRACKING,
    ...base,
    origem: canonicalOrigem(base?.origem) || base?.origem || null,
  };
  const right: ContactTracking = {
    ...EMPTY_TRACKING,
    ...incoming,
    origem: canonicalOrigem(incoming?.origem) || incoming?.origem || null,
  };

  const useIncomingOrigem = originRank(right.origem) > originRank(left.origem);
  const origem = useIncomingOrigem ? right.origem : left.origem || right.origem;
  const adsKept = isAdsOrigem(origem) && !useIncomingOrigem;

  const campanha = adsKept
    ? firstHumanCampaign(left.campanha, left.headline)
    : firstHumanCampaign(
        useIncomingOrigem ? right.campanha : left.campanha,
        useIncomingOrigem ? left.campanha : right.campanha
      );

  return {
    origem,
    campanha,
    headline: pickText(right.headline, left.headline),
    ctwa_clid: pickText(right.ctwa_clid, left.ctwa_clid),
    fbclid: pickText(right.fbclid, left.fbclid),
    gclid: pickText(right.gclid, left.gclid),
    referrer: pickText(right.referrer, left.referrer),
  };
}
