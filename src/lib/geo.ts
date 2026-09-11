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

export async function geocodeCep(cep: string): Promise<Coordinates | null> {
  const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const lat = Number(data?.location?.coordinates?.latitude);
  const lng = Number(data?.location?.coordinates?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  const fallback = [data.street, data.neighborhood, data.city, data.state, 'Brasil']
    .filter(Boolean)
    .join(', ');

  return geocodeAddress(fallback);
}
