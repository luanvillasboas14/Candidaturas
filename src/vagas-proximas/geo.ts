export interface Coordinates {
  lat: number;
  lng: number;
}

const addressCache = new Map<string, Coordinates | null>();

export function normalizeCep(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { postcode?: string; city?: string; district?: string };
};

function coordsFromPhotonFeature(feature: PhotonFeature | undefined): Coordinates | null {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

let lastPhotonAt = 0;

export async function waitPhotonSlot() {
  const wait = 1100 - (Date.now() - lastPhotonAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastPhotonAt = Date.now();
}

function featureCity(feature: PhotonFeature): string {
  return cityKey(String(feature.properties?.city || feature.properties?.district || ''));
}

async function geocodeWithPhoton(
  query: string,
  cep?: string,
  expectedCity?: string
): Promise<Coordinates | null> {
  try {
    await waitPhotonSlot();
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
    if (features.length === 0) return null;

  const cepDigits = cep?.replace(/\D/g, '') || '';
  if (cepDigits.length === 8) {
    return coordsFromPhotonFeature(pickByCep(features, cepDigits) ?? undefined);
  }

  const wantedCity = expectedCity ? cityKey(expectedCity) : '';
  const inCity = wantedCity
    ? features.filter((feature) => !featureCity(feature) || featureCity(feature) === wantedCity)
    : features;
    return coordsFromPhotonFeature(inCity[0] || features[0]);
  } catch {
    return null;
  }
}

function postcodeDigits(feature: PhotonFeature): string {
  return String(feature.properties?.postcode || '').replace(/\D/g, '');
}

function pickByCep(pool: PhotonFeature[], cepDigits: string): PhotonFeature | null {
  const exact = pool.find((feature) => postcodeDigits(feature) === cepDigits);
  if (exact) return exact;

  const withPostcode = pool.filter((feature) => postcodeDigits(feature).length >= 5);
  if (withPostcode.length === 0) return null;

  const sameFive = withPostcode.find((feature) => postcodeDigits(feature).startsWith(cepDigits.slice(0, 5)));
  if (sameFive) return sameFive;

  const sameFour = withPostcode.find((feature) => postcodeDigits(feature).startsWith(cepDigits.slice(0, 4)));
  return sameFour || null;
}

export async function geocodeAddress(
  address: string,
  cep?: string,
  expectedCity?: string
): Promise<Coordinates | null> {
  const key = `${address.trim().toLowerCase()}|${cep || ''}|${expectedCity || ''}`;
  if (!address.trim()) {
    return null;
  }

  if (addressCache.has(key)) {
    return addressCache.get(key) ?? null;
  }

  let coordinates = await geocodeWithPhoton(`${address}, Brasil`, cep, expectedCity);
  if (!coordinates) {
    coordinates = await geocodeWithPhoton(address, cep, expectedCity);
  }

  addressCache.set(key, coordinates);
  return coordinates;
}

const SAO_PAULO_CITY_CENTER: Coordinates = { lat: -23.5475, lng: -46.63611 };

function parseCoordinates(latRaw: unknown, lngRaw: unknown): Coordinates | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function cityKey(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isGenericCityCenter(coords: Coordinates, city: string): boolean {
  return cityKey(city) === 'sao paulo' && haversineKm(coords, SAO_PAULO_CITY_CENTER) < 1.5;
}

function isUsableOrigin(coords: Coordinates | null, city: string): coords is Coordinates {
  if (!coords) return false;
  if (isGenericCityCenter(coords, city)) return false;
  if (!city && haversineKm(coords, SAO_PAULO_CITY_CENTER) < 1.5) return false;
  return true;
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function geocodeCepAwesomeApi(cep: string): Promise<Coordinates | null> {
  const data = await fetchJson(`https://cep.awesomeapi.com.br/json/${cep}`, 4000);
  if (!data || typeof data !== 'object') return null;
  const row = data as { lat?: unknown; lng?: unknown };
  return parseCoordinates(row.lat, row.lng);
}

interface CepLookup {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  coords: Coordinates | null;
}

async function lookupBrasilApi(cep: string): Promise<CepLookup | null> {
  const data = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`, 4000);
  if (!data || typeof data !== 'object') return null;
  const row = data as {
    street?: unknown;
    neighborhood?: unknown;
    city?: unknown;
    state?: unknown;
    location?: { coordinates?: { latitude?: unknown; longitude?: unknown } };
  };
  return {
    street: typeof row.street === 'string' ? row.street : undefined,
    neighborhood: typeof row.neighborhood === 'string' ? row.neighborhood : undefined,
    city: typeof row.city === 'string' ? row.city : undefined,
    state: typeof row.state === 'string' ? row.state : undefined,
    coords: parseCoordinates(
      row.location?.coordinates?.latitude,
      row.location?.coordinates?.longitude
    ),
  };
}

async function lookupViaCep(cep: string): Promise<CepLookup | null> {
  const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`, 4000);
  if (!data || typeof data !== 'object') return null;
  const row = data as {
    erro?: unknown;
    logradouro?: unknown;
    bairro?: unknown;
    localidade?: unknown;
    uf?: unknown;
  };
  if (row.erro) return null;
  return {
    street: typeof row.logradouro === 'string' ? row.logradouro : undefined,
    neighborhood: typeof row.bairro === 'string' ? row.bairro : undefined,
    city: typeof row.localidade === 'string' ? row.localidade : undefined,
    state: typeof row.uf === 'string' ? row.uf : undefined,
    coords: null,
  };
}

const cepGeoCache = new Map<string, Coordinates | null>();

export async function geocodeCep(cep: string): Promise<Coordinates | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  if (cepGeoCache.has(digits)) return cepGeoCache.get(digits) ?? null;

  const [viaCep, awesome] = await Promise.all([
    lookupViaCep(digits),
    geocodeCepAwesomeApi(digits),
  ]);
  let street = viaCep?.street;
  let neighborhood = viaCep?.neighborhood;
  let city = viaCep?.city || '';
  let state = viaCep?.state || '';
  let brasil: CepLookup | null = null;

  if (!isUsableOrigin(awesome, city)) {
    brasil = await lookupBrasilApi(digits);
    street = street || brasil?.street;
    neighborhood = neighborhood || brasil?.neighborhood;
    city = city || brasil?.city || '';
    state = state || brasil?.state || '';
  }

  let result: Coordinates | null = null;
  if (isUsableOrigin(awesome, city)) {
    result = awesome;
  } else if (isUsableOrigin(brasil?.coords ?? null, city)) {
    result = brasil?.coords ?? null;
  }

  const photonQueries = [
    street && neighborhood && city ? `${street}, ${neighborhood}, ${city}, ${state || 'SP'}` : null,
    street && city ? `${street}, ${city}, ${state || 'SP'}` : null,
  ].filter((query): query is string => Boolean(query));

  if (!result) {
    for (const query of photonQueries) {
      const fromPhoton = await geocodeWithPhoton(query, digits, city);
      if (isUsableOrigin(fromPhoton, city)) {
        result = fromPhoton;
        break;
      }
    }
  }
  if (!result && city && cityKey(city) !== 'sao paulo') {
    result = await geocodeWithPhoton(`${city}, ${state || 'SP'}, Brasil`, undefined, city);
  }

  if (result) cepGeoCache.set(digits, result);
  return result;
}

export async function reverseCep(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  await waitPhotonSlot();
  const url = new URL('https://photon.komoot.io/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('lang', 'pt');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' },
  });
  if (!response.ok) return null;

  const data = await response.json();
  const postcode = String(data?.features?.[0]?.properties?.postcode || '').replace(/\D/g, '');
  return postcode.length === 8 ? postcode : null;
}
