import { NextResponse } from 'next/server';
import { preverDocumento } from '@/banco-candidatos/demitir';

export const runtime = 'nodejs';
export const maxDuration = 60;

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await preverDocumento({
      idCandidato: readText(body.idCandidato),
      idVaga: readText(body.idVaga),
      motivo: readText(body.motivo),
      dataDemissao: readText(body.dataDemissao),
      avaliacao: readText(body.avaliacao),
      resumoAtividades: readText(body.resumoAtividades),
    });
    return NextResponse.json({ ok: true, html: data.html });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao montar a prévia.';
    const status = message.includes('inválid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
