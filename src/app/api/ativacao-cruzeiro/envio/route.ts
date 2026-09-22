import { NextResponse } from 'next/server';
import { registrarEnvioAtivacao } from '@/ativacao-cruzeiro/queries';

export const runtime = 'nodejs';
export const maxDuration = 60;

function readInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readSeries(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return readText(value) ? [String(value)] : undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await registrarEnvioAtivacao({
      idadeMin: readInt(body.idadeMin),
      idadeMax: readInt(body.idadeMax),
      curso: readText(body.curso),
      serie: readSeries(body.serie),
      sexo: readText(body.sexo),
      bairro: readText(body.bairro),
      cep: readText(body.cep),
      raioKm: readInt(body.raioKm),
      vagaId: readText(body.vagaId),
      quantidade: readInt(body.quantidade),
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao registrar o envio.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
