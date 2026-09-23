import { NextResponse } from 'next/server';
import { getCandidatoDetalhe } from '@/banco-candidatos/queries';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const vagaId = url.searchParams.get('vagaId') || undefined;
    const data = await getCandidatoDetalhe(id, vagaId);
    if (!data) return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar o candidato.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
