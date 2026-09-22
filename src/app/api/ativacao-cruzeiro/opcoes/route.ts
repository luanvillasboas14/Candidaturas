import { NextResponse } from 'next/server';
import { listarOpcoesAtivacao } from '@/ativacao-cruzeiro/queries';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await listarOpcoesAtivacao();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar opções.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
