import { NextResponse } from 'next/server';
import { listarCandidatos } from '@/banco-candidatos/queries';
import { isStatusFiltro } from '@/banco-candidatos/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) return undefined;
  return Number(value);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const data = await listarCandidatos({
      nome: readText(url.searchParams.get('nome')),
      cadastroDe: readText(url.searchParams.get('cadastroDe')),
      cadastroAte: readText(url.searchParams.get('cadastroAte')),
      cargo: readText(url.searchParams.get('cargo')),
      cep: readText(url.searchParams.get('cep')),
      lat: readNumber(url.searchParams.get('lat')),
      lng: readNumber(url.searchParams.get('lng')),
      raioKm: readNumber(url.searchParams.get('raioKm')),
      formacao: readNumber(url.searchParams.get('formacao')),
      salarioMin: readNumber(url.searchParams.get('salarioMin')),
      salarioMax: readNumber(url.searchParams.get('salarioMax')),
      tipoContratacao: readNumber(url.searchParams.get('tipoContratacao')),
      status: isStatusFiltro(url.searchParams.get('status') || '')
        ? url.searchParams.get('status') || undefined
        : undefined,
      page: readNumber(url.searchParams.get('page')),
      pageSize: readNumber(url.searchParams.get('pageSize')),
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao listar candidatos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
