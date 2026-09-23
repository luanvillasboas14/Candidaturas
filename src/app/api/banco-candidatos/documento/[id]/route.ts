import { NextResponse } from 'next/server';
import { getTextoContrato } from '@/banco-candidatos/queries';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await getTextoContrato(id);
    if (!data) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao abrir o documento.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
