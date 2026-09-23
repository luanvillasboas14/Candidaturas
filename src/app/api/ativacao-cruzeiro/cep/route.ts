import { NextResponse } from 'next/server';
import { reverseCep } from '@/vagas-proximas/geo';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 });
  }

  try {
    const cep = await reverseCep(lat, lng);
    return NextResponse.json({ cep });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao localizar o CEP.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
