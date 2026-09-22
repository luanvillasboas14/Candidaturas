import { geocodeCep, haversineKm, waitPhotonSlot } from '@/vagas-proximas/geo';

export type LocalGeo = {
  lat: number;
  lng: number;
  cep: string | null;
};

const SAO_PAULO_CENTER = { lat: -23.5475, lng: -46.63611 };

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { postcode?: string; city?: string };
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function localKey(cidade: string, bairro: string): string {
  return `${fold(cidade)}|${fold(bairro)}`;
}

export function isLocalValido(cidade: string, bairro: string): boolean {
  const city = fold(cidade);
  const hood = fold(bairro);
  if (city.length < 3 || /^\d+$/.test(city)) return false;
  if (hood && /^\d+$/.test(hood) && hood.length < 3) return false;
  return true;
}

function coordsAndCep(feature: PhotonFeature | undefined): LocalGeo | null {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const digits = String(feature?.properties?.postcode || '').replace(/\D/g, '');
  return { lat, lng, cep: digits.length === 8 ? digits : null };
}

function isSaoPauloCenter(coords: { lat: number; lng: number }, cidade: string): boolean {
  const city = fold(cidade);
  return city === 'sao paulo' && haversineKm(coords, SAO_PAULO_CENTER) < 1.5;
}

async function geocodePhoton(query: string): Promise<LocalGeo | null> {
  await waitPhotonSlot();
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '3');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
  const withCep = features.find((feature) => coordsAndCep(feature)?.cep);
  return coordsAndCep(withCep) || coordsAndCep(features[0]);
}

export async function geocodeCidadeBairro(cidade: string, bairro: string): Promise<LocalGeo | null> {
  const city = cidade.trim();
  const hood = bairro.trim();
  if (!city) return null;
  const queries = [
    hood ? `${hood}, ${city}, Brasil` : null,
    hood ? `${hood}, ${city}, SP, Brasil` : null,
    fold(city) === 'sao paulo' ? null : `${city}, Brasil`,
  ].filter((query): query is string => Boolean(query));

  for (const query of queries) {
    const found = await geocodePhoton(query);
    if (found && !isSaoPauloCenter(found, city)) return found;
    if (found?.cep) return found;
  }
  return null;
}

export async function geocodeBairroComoVagas(cidade: string, bairro: string): Promise<LocalGeo | null> {
  const photon = await geocodeCidadeBairro(cidade, bairro);
  if (!photon) return null;
  if (!photon.cep) return photon;

  const refined = await geocodeCep(photon.cep);
  if (refined && !isSaoPauloCenter(refined, cidade)) {
    return { lat: refined.lat, lng: refined.lng, cep: photon.cep };
  }
  return photon;
}
