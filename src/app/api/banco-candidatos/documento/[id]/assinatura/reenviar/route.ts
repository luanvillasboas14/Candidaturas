import { NextResponse } from 'next/server';
import { reenviarEmailAssinante } from '@/banco-candidatos/assinatura';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { token?: string };
    if (!body.token) return NextResponse.json({ error: 'Assinante sem token.' }, { status: 400 });
    await reenviarEmailAssinante(id, body.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao reenviar o e-mail.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
