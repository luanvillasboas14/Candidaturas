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

async function geocodeWithPhoton(query: string): Promise<Coordinates | null> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'CandidaturasDNAWork/1.0' },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const coords = data?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const key = address.trim().toLowerCase();
  if (!key) {
    return null;
  }

  if (addressCache.has(key)) {
    return addressCache.get(key) ?? null;
  }

  let coordinates = await geocodeWithPhoton(`${address}, Brasil`);
  if (!coordinates) {
    coordinates = await geocodeWithPhoton(address);
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

function isGenericCityCenter(coords: Coordinates, city: string): boolean {
  const cityKey = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return cityKey === 'sao paulo' && haversineKm(coords, SAO_PAULO_CITY_CENTER) < 1.5;
}

async function geocodeCepAwesomeApi(cep: string): Promise<Coordinates | null> {
  const response = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`);
  if (!response.ok) return null;
  const data = await response.json();
  return parseCoordinates(data?.lat, data?.lng);
}

export async function geocodeCep(cep: string): Promise<Coordinates | null> {
  const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!response.ok) {
    return geocodeCepAwesomeApi(cep);
  }

  const data = await response.json();
  const streetAddress = [data.street, data.neighborhood, data.city, data.state, 'Brasil']
    .filter(Boolean)
    .join(', ');

  if (data.street) {
    const fromStreet = await geocodeAddress(streetAddress);
    if (fromStreet) return fromStreet;
  }

  const fromAwesome = await geocodeCepAwesomeApi(cep);
  if (fromAwesome) return fromAwesome;

  const fromBrasilApi = parseCoordinates(
    data?.location?.coordinates?.latitude,
    data?.location?.coordinates?.longitude
  );
  if (fromBrasilApi && !isGenericCityCenter(fromBrasilApi, String(data.city || ''))) {
    return fromBrasilApi;
  }

  const cityAddress = [data.city, data.state, 'Brasil'].filter(Boolean).join(', ');
  return cityAddress ? geocodeAddress(cityAddress) : null;
}
