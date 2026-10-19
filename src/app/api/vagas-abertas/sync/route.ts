import { NextResponse } from 'next/server';
import { slotDe } from '@/vagas-abertas/agendar';
import { sincronizarVagasAbertas } from '@/vagas-abertas/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const resultado = await sincronizarVagasAbertas(slotDe());
    return NextResponse.json({ success: true, ...resultado });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível entrar as vagas novas.';
    console.error('[vagas-abertas]', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
