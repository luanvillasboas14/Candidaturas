import { NextResponse } from 'next/server';
import { listarFormacoes, listarModalidades } from '@/banco-candidatos/queries';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [formacoes, modalidades] = await Promise.all([listarFormacoes(), listarModalidades()]);
    return NextResponse.json({ formacoes, modalidades });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar opções.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
