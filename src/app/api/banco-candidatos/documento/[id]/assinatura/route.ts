import { NextResponse } from 'next/server';
import { AssinaturaErro, enviarAssinatura } from '@/banco-candidatos/assinatura';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { pdfBase64?: string };
    const data = await enviarAssinatura(id, body.pdfBase64 || '');
    return NextResponse.json(data);
  } catch (error) {
    const faltando = error instanceof AssinaturaErro ? error.faltando : undefined;
    const message = error instanceof Error ? error.message : 'Falha ao enviar para assinatura.';
    return NextResponse.json({ error: message, faltando }, { status: error instanceof AssinaturaErro ? 400 : 500 });
  }
}
