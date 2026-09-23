import { geocodeCep, haversineKm, waitPhotonSlot } from '@/vagas-proximas/geo';

export type LocalGeo = {
  lat: number;
  lng: number;
  cep: string | null;
};

const SAO_PAULO_CENTER = { lat: -23.5475, lng: -46.63611 };
const GENERIC = new Set([
  'sao',
  'santo',
  'santa',
  'zona',
  'leste',
  'oeste',
  'norte',
  'sul',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'jardim',
  'vila',
  'parque',
  'conjunto',
  'residencial',
  'loteamento',
  'recanto',
  'chacara',
  'fazenda',
  'sitio',
  'nucleo',
  'rua',
  'avenida',
  'alameda',
  'travessa',
  'estrada',
  'rodovia',
]);

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: {
    postcode?: string;
    city?: string;
    district?: string;
    name?: string;
    locality?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    state?: string;
  };
};

export function fold(value: string): string {
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

export function isRuaValida(rua: string): boolean {
  const texto = fold(rua).replace(/\b(rua|r|avenida|av|alameda|al|travessa|tv|estrada|rodovia)\b/g, '').trim();
  return texto.length >= 4 && /[a-z]/.test(texto);
}

export function localKeyRua(cidade: string, rua: string): string {
  return `rua|${fold(cidade)}|${fold(rua)}`;
}

export function chaveLocal(cidade: string, bairro: string, endereco?: string): string {
  return endereco && isRuaValida(endereco) ? localKeyRua(cidade, endereco) : localKey(cidade, bairro);
}

function stripZona(bairro: string): string {
  return fold(bairro)
    .replace(/\bzona (leste|oeste|norte|sul)\b/g, '')
    .trim();
}

function zonaHint(bairro: string): 'leste' | 'oeste' | 'norte' | 'sul' | null {
  const match = fold(bairro).match(/\bzona (leste|oeste|norte|sul)\b/);
  return (match?.[1] as 'leste' | 'oeste' | 'norte' | 'sul') || null;
}

function inZona(coords: { lat: number; lng: number }, zona: ReturnType<typeof zonaHint>): boolean {
  if (!zona) return true;
  if (zona === 'leste') return coords.lng > -46.56 && coords.lng < -46.36 && coords.lat < -23.47 && coords.lat > -23.64;
  if (zona === 'oeste') return coords.lng < -46.68;
  if (zona === 'norte') return coords.lat > -23.5;
  return coords.lat < -23.6;
}

function tokensBairro(bairro: string): string[] {
  return stripZona(bairro)
    .split(' ')
    .filter((token) => token.length > 2 && !GENERIC.has(token));
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

function isPoi(feature: PhotonFeature): boolean {
  const key = feature.properties?.osm_key || '';
  const value = feature.properties?.osm_value || '';
  if (key === 'shop' || key === 'amenity' || key === 'tourism' || key === 'office') return true;
  if (key === 'highway' || key === 'waterway' || key === 'railway') return true;
  if (value.includes('construction')) return true;
  const name = fold(feature.properties?.name || '');
  return /shopping|piscin|banco|mercado|hospital|escola/.test(name);
}

function isPlace(feature: PhotonFeature): boolean {
  const key = feature.properties?.osm_key;
  const value = feature.properties?.osm_value || '';
  if (key === 'place') return true;
  return ['suburb', 'neighbourhood', 'quarter', 'city_block', 'district', 'hamlet', 'village'].includes(
    value
  );
}

function nameScore(bairro: string, feature: PhotonFeature): number {
  const name = fold(feature.properties?.name || '');
  const district = fold(feature.properties?.district || '');
  const hood = stripZona(bairro);
  if (!name) return 0;
  if (name === hood) return 100;
  if (district === hood) return 80;
  const tokens = tokensBairro(bairro);
  if (!tokens.length) return 0;
  const hitName = tokens.filter((token) => name.includes(token)).length;
  const hitAll = tokens.filter((token) => name.includes(token) || district.includes(token)).length;
  if (hitName === tokens.length) return 90;
  if (hitAll === tokens.length) return 70;
  if (hitName >= 1 && hitName === tokens.length - 1 && tokens.length >= 2) return 40;
  const nucleo = tokens[tokens.length - 1];
  if (nucleo && (name === nucleo || district === nucleo)) return 35;
  return 0;
}

function pickFeature(
  features: PhotonFeature[],
  cidade: string,
  bairro: string
): { feature: PhotonFeature; score: number } | null {
  const city = fold(cidade);
  const zona = zonaHint(bairro);
  let best: { feature: PhotonFeature; score: number } | null = null;

  for (const feature of features) {
    const geo = coordsAndCep(feature);
    if (!geo || isSaoPauloCenter(geo, cidade) || isPoi(feature)) continue;
    const featureCity = fold(feature.properties?.city || '');
    if (city === 'sao paulo' && featureCity && featureCity !== 'sao paulo') continue;
    if (city && featureCity && featureCity !== city && !featureCity.includes(city) && !city.includes(featureCity)) {
      continue;
    }
    let score = nameScore(bairro, feature);
    if (score <= 0) continue;
    if (zona && !inZona(geo, zona)) continue;
    if (isPlace(feature)) score += 15;
    if (inZona(geo, zona)) score += 10;
    if (!best || score > best.score) best = { feature, score };
  }

  return best;
}

export function pontoDoBairro(coords: { lat: number; lng: number }, bairro: string): {
  lat: number;
  lng: number;
} {
  return deslocarPorBairro({ ...coords, cep: null }, bairro);
}

function deslocarPorBairro(coords: LocalGeo, bairro: string): LocalGeo {
  const key = fold(bairro);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33 + key.charCodeAt(i)) >>> 0;
  const angle = ((hash % 360) * Math.PI) / 180;
  const meters = 400 + (hash % 1100);
  const latRad = (coords.lat * Math.PI) / 180;
  return {
    lat: coords.lat + (meters * Math.cos(angle)) / 111320,
    lng: coords.lng + (meters * Math.sin(angle)) / (111320 * Math.max(0.2, Math.cos(latRad))),
    cep: coords.cep,
  };
}

async function geocodePhoton(query: string): Promise<PhotonFeature[]> {
  await waitPhotonSlot();
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data?.features) ? data.features : [];
}

async function geocodeNominatim(cidade: string, bairro: string): Promise<LocalGeo | null> {
  await waitPhotonSlot();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${stripZona(bairro)}, ${cidade}, Brasil`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'br');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' },
  });
  if (!response.ok) return null;
  const items: Array<{
    lat?: string;
    lon?: string;
    name?: string;
    type?: string;
    addresstype?: string;
    display_name?: string;
  }> = await response.json();
  const wanted = tokensBairro(bairro);
  for (const item of items) {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const name = fold(`${item.name || ''} ${item.display_name || ''}`);
    const tipo = item.type || item.addresstype || '';
    const poi = ['shop', 'amenity', 'bank', 'supermarket'].includes(tipo);
    if (poi) continue;
    if (wanted.length && !wanted.every((token) => name.includes(token))) continue;
    if (isSaoPauloCenter({ lat, lng }, cidade)) continue;
    if (!inZona({ lat, lng }, zonaHint(bairro))) continue;
    if (fold(cidade) === 'sao paulo' && !name.includes('sao paulo')) continue;
    return { lat, lng, cep: null };
  }
  return null;
}

export async function geocodeCidadeBairro(cidade: string, bairro: string): Promise<LocalGeo | null> {
  const city = cidade.trim() || 'São Paulo';
  const hood = bairro.trim();
  if (!hood) return null;
  const zona = zonaHint(hood);
  const base = stripZona(hood);
  const nucleo = tokensBairro(hood).at(-1);
  const queries = [
    `${base}, ${city}, Brasil`,
    zona ? `${base}, Zona ${zona}, ${city}, Brasil` : null,
    `${base}, ${city}, SP, Brasil`,
    nucleo && nucleo !== base ? `${nucleo}, ${city}, Brasil` : null,
  ].filter((query): query is string => Boolean(query));

  let parcial: LocalGeo | null = null;

  for (const query of queries) {
    const picked = pickFeature(await geocodePhoton(query), city, hood);
    if (!picked) continue;
    const geo = coordsAndCep(picked.feature);
    if (!geo) continue;
    const featureName = fold(picked.feature.properties?.name || '');
    if (picked.score >= 90 && featureName === stripZona(hood)) return geo;
    if (picked.score >= 35) parcial = parcial || deslocarPorBairro(geo, hood);
  }

  const nominatim = await geocodeNominatim(city, hood);
  if (nominatim) return nominatim;
  return parcial;
}

export async function geocodeBairroComoVagas(cidade: string, bairro: string): Promise<LocalGeo | null> {
  const photon = await geocodeCidadeBairro(cidade, bairro);
  if (!photon) return null;
  if (!photon.cep) return photon;

  const refined = await geocodeCep(photon.cep);
  if (refined && !isSaoPauloCenter(refined, cidade) && haversineKm(photon, refined) <= 2.5) {
    return { lat: refined.lat, lng: refined.lng, cep: photon.cep };
  }
  return photon;
}

function cidadeViaCep(cidade: string): string {
  return fold(cidade) === 'sao paulo' ? 'São Paulo' : cidade.trim();
}

function logradouroViaCep(rua: string): string {
  return rua
    .trim()
    .replace(/^\s*(rua|r\.?|avenida|av\.?|alameda|al\.?|travessa|tv\.?)\s+/i, '')
    .trim();
}

let lastViaCepAt = 0;

async function waitViaCepSlot() {
  const wait = 280 - (Date.now() - lastViaCepAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastViaCepAt = Date.now();
}

async function viaCepPorRua(cidade: string, rua: string, bairro?: string): Promise<LocalGeo | null> {
  const logradouro = logradouroViaCep(rua);
  if (logradouro.length < 4) return null;
  await waitViaCepSlot();
  const url = `https://viacep.com.br/ws/SP/${encodeURIComponent(cidadeViaCep(cidade))}/${encodeURIComponent(logradouro)}/json/`;
  const response = await fetch(url, { headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' } });
  if (!response.ok) return null;
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0 || data[0]?.erro) return null;

  const hood = fold(bairro || '');
  const hit =
    (hood &&
      data.find((item: { bairro?: string }) => {
        const itemBairro = fold(item.bairro || '');
        return itemBairro && (itemBairro.includes(hood) || hood.includes(itemBairro));
      })) ||
    data[0];
  const cep = String(hit?.cep || '').replace(/\D/g, '');
  if (cep.length !== 8) return null;

  const refined = await geocodeCep(cep);
  if (!refined || isSaoPauloCenter(refined, cidade)) return null;
  return { lat: refined.lat, lng: refined.lng, cep };
}

function pickStreetFeature(features: PhotonFeature[], cidade: string, rua: string): PhotonFeature | null {
  const city = fold(cidade);
  const tokens = tokensBairro(rua);
  let best: { feature: PhotonFeature; score: number } | null = null;

  for (const feature of features) {
    const geo = coordsAndCep(feature);
    if (!geo || isSaoPauloCenter(geo, cidade)) continue;
    const key = feature.properties?.osm_key || '';
    if (key === 'shop' || key === 'amenity' || key === 'tourism' || key === 'office') continue;
    const featureCity = fold(feature.properties?.city || '');
    if (city === 'sao paulo' && featureCity && featureCity !== 'sao paulo') continue;
    const name = fold(feature.properties?.name || '');
    if (!tokens.length || !tokens.every((token) => name.includes(token))) continue;
    let score = 50;
    if (key === 'highway') score += 20;
    if (geo.cep) score += 15;
    if (!best || score > best.score) best = { feature, score };
  }
  return best?.feature || null;
}

export async function geocodeCidadeRua(
  cidade: string,
  rua: string,
  bairro?: string
): Promise<LocalGeo | null> {
  const city = cidade.trim() || 'São Paulo';
  const street = rua.trim();
  if (!isRuaValida(street)) return null;

  const viaCep = await viaCepPorRua(city, street, bairro);
  if (viaCep && viaCep.lat !== 0 && viaCep.lng !== 0) return viaCep;

  const queries = [
    `${street}, ${city}, Brasil`,
    bairro ? `${street}, ${bairro}, ${city}, Brasil` : null,
  ].filter((query): query is string => Boolean(query));

  for (const query of queries) {
    const feature = pickStreetFeature(await geocodePhoton(query), city, street);
    const geo = coordsAndCep(feature ?? undefined);
    if (!geo) continue;
    if (geo.cep) {
      const refined = await geocodeCep(geo.cep);
      if (refined && !isSaoPauloCenter(refined, city)) {
        return { lat: refined.lat, lng: refined.lng, cep: geo.cep };
      }
    }
    return geo;
  }

  return bairro ? geocodeBairroComoVagas(city, bairro) : null;
}

export async function geocodeAlunoLocal(
  cidade: string,
  bairro: string,
  endereco?: string
): Promise<LocalGeo | null> {
  if (endereco && isRuaValida(endereco)) {
    return geocodeCidadeRua(cidade, endereco, bairro);
  }
  if (isLocalValido(cidade, bairro)) {
    return geocodeBairroComoVagas(cidade, bairro);
  }
  return null;
}
