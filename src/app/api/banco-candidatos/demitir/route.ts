import { NextResponse } from 'next/server';
import { demitirCandidato } from '@/banco-candidatos/demitir';

export const runtime = 'nodejs';
export const maxDuration = 60;

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await demitirCandidato({
      idCandidato: readText(body.idCandidato),
      idVaga: readText(body.idVaga),
      motivo: readText(body.motivo),
      dataDemissao: readText(body.dataDemissao),
      motivoInterno: readText(body.motivoInterno),
      avaliacao: readText(body.avaliacao),
      resumoAtividades: readText(body.resumoAtividades),
      previu: body.previu === true,
    });
    return NextResponse.json({
      ok: true,
      idContrato: data.idContrato,
      html: data.html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao demitir.';
    const status = message.includes('já demitido') || message.includes('inválid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
