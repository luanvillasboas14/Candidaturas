import { NextResponse } from 'next/server';
import { criarGrupo, listarGrupos } from '@/grupos-empresas/gravar';

export const runtime = 'nodejs';

function texto(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function GET() {
  try {
    const grupos = await listarGrupos();
    return NextResponse.json({ success: true, grupos });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível listar os grupos.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const grupo = await criarGrupo({
      nome: texto(body.nome),
      email: texto(body.email),
      telefone: texto(body.telefone),
    });
    return NextResponse.json({ success: true, grupo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gravar o grupo.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
