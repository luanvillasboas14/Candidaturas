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
  await waitPhotonSlot();
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
  if (features.length === 0) return null;

  const wantedCity = expectedCity ? cityKey(expectedCity) : '';
  const inCity = wantedCity
    ? features.filter((feature) => !featureCity(feature) || featureCity(feature) === wantedCity)
    : features;
  const pool = inCity.length ? inCity : features;

  const cepDigits = cep?.replace(/\D/g, '') || '';
  if (cepDigits.length === 8) {
    const byCep = pool.find(
      (feature) => String(feature.properties?.postcode || '').replace(/\D/g, '') === cepDigits
    );
    const matched = coordsFromPhotonFeature(byCep);
    if (matched) return matched;
  }

  return coordsFromPhotonFeature(pool[0]);
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

const CITY_MATCH_KM = 30;

function isNearCity(coords: Coordinates, cityCoords: Coordinates | null): boolean {
  if (!cityCoords) return true;
  return haversineKm(coords, cityCoords) <= CITY_MATCH_KM;
}

function isUsableOrigin(
  coords: Coordinates | null,
  city: string,
  cityCoords: Coordinates | null
): coords is Coordinates {
  return (
    Boolean(coords) &&
    !isGenericCityCenter(coords as Coordinates, city) &&
    isNearCity(coords as Coordinates, cityCoords)
  );
}

async function geocodeCepAwesomeApi(cep: string): Promise<Coordinates | null> {
  const response = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`);
  if (!response.ok) return null;
  const data = await response.json();
  return parseCoordinates(data?.lat, data?.lng);
}

interface CepLookup {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  coords: Coordinates | null;
}

async function lookupBrasilApi(cep: string): Promise<CepLookup | null> {
  const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!response.ok) return null;
  const data = await response.json();
  return {
    street: typeof data.street === 'string' ? data.street : undefined,
    neighborhood: typeof data.neighborhood === 'string' ? data.neighborhood : undefined,
    city: typeof data.city === 'string' ? data.city : undefined,
    state: typeof data.state === 'string' ? data.state : undefined,
    coords: parseCoordinates(
      data?.location?.coordinates?.latitude,
      data?.location?.coordinates?.longitude
    ),
  };
}

async function lookupViaCep(cep: string): Promise<CepLookup | null> {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) return null;
  const data = await response.json();
  if (!data || data.erro) return null;
  return {
    street: typeof data.logradouro === 'string' ? data.logradouro : undefined,
    neighborhood: typeof data.bairro === 'string' ? data.bairro : undefined,
    city: typeof data.localidade === 'string' ? data.localidade : undefined,
    state: typeof data.uf === 'string' ? data.uf : undefined,
    coords: null,
  };
}

function formattedCep(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

const cepGeoCache = new Map<string, Coordinates | null>();

export async function geocodeCep(cep: string): Promise<Coordinates | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  if (cepGeoCache.has(digits)) return cepGeoCache.get(digits) ?? null;

  const [viaCep, brasil, awesome] = await Promise.all([
    lookupViaCep(digits),
    lookupBrasilApi(digits),
    geocodeCepAwesomeApi(digits),
  ]);
  const street = viaCep?.street || brasil?.street;
  const neighborhood = viaCep?.neighborhood || brasil?.neighborhood;
  const city = viaCep?.city || brasil?.city || '';
  const state = viaCep?.state || brasil?.state || 'SP';
  const cityCoords = city ? await geocodeAddress(`${city}, ${state}, Brasil`, undefined, city) : null;
  let result: Coordinates | null = null;

  const photonQueries = [
    street && neighborhood ? `${street}, ${neighborhood}, ${city}, ${state}` : null,
    street && city ? `${street}, ${city}, ${state}` : null,
    city ? `${formattedCep(digits)}, ${city}, ${state}` : null,
  ].filter((query): query is string => Boolean(query));

  for (const query of photonQueries) {
    const fromPhoton = await geocodeAddress(query, digits, city);
    if (isUsableOrigin(fromPhoton, city, cityCoords)) {
      result = fromPhoton;
      break;
    }
  }

  if (!result && isUsableOrigin(brasil?.coords ?? null, city, cityCoords)) {
    result = brasil?.coords ?? null;
  }
  if (!result && isUsableOrigin(awesome, city, cityCoords)) {
    result = awesome;
  }
  if (!result && city && cityKey(city) !== 'sao paulo') {
    result = cityCoords;
  }

  cepGeoCache.set(digits, result);
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
