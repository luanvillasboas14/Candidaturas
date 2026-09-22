import { NextResponse } from 'next/server';
import { sincronizarAlunosCep, statusAlunosCep } from '@/ativacao-cruzeiro/alunos-cep-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json(await statusAlunosCep());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao ler o sync de CEP.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json(await sincronizarAlunosCep());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar alunos_cep.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
