import { NextResponse } from 'next/server';
import { aplicarWebhookZap } from '@/banco-candidatos/assinatura';
import type { ZapDoc } from '@/lib/zapsign';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ZapDoc & { token?: string };
    await aplicarWebhookZap(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no webhook ZapSign.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
