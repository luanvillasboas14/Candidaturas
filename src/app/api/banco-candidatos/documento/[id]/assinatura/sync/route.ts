import { NextResponse } from 'next/server';
import { sincronizarEnvelope } from '@/banco-candidatos/assinatura';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const envelope = await sincronizarEnvelope(id);
    return NextResponse.json({ envelope });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar o status.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
