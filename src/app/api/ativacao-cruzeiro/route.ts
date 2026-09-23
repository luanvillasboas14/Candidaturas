import { NextResponse } from 'next/server';
import { listarAlunosAtivacao } from '@/ativacao-cruzeiro/queries';

export const runtime = 'nodejs';
export const maxDuration = 60;

function readInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function readNumber(value: string | null): number | undefined {
  if (!value || !/^-?\d+(\.\d+)?$/.test(value)) return undefined;
  return Number(value);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const data = await listarAlunosAtivacao({
      idadeMin: readInt(url.searchParams.get('idadeMin')),
      idadeMax: readInt(url.searchParams.get('idadeMax')),
      curso: url.searchParams.getAll('curso'),
      serie: url.searchParams.getAll('serie'),
      sexo: url.searchParams.get('sexo') || undefined,
      bairro: url.searchParams.get('bairro') || undefined,
      cep: url.searchParams.get('cep') || undefined,
      lat: readNumber(url.searchParams.get('lat')),
      lng: readNumber(url.searchParams.get('lng')),
      raioKm: readNumber(url.searchParams.get('raioKm')),
      vagaId: url.searchParams.get('vagaId') || undefined,
      quantidade: readInt(url.searchParams.get('quantidade')),
      page: readInt(url.searchParams.get('page')),
      pageSize: readInt(url.searchParams.get('pageSize')),
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao filtrar alunos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
