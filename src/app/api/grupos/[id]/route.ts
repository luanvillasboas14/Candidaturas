import { NextResponse } from 'next/server';
import { apagarGrupo, atualizarGrupo } from '@/grupos-empresas/gravar';

export const runtime = 'nodejs';

function texto(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const grupo = await atualizarGrupo(id, {
      nome: texto(body.nome),
      email: texto(body.email),
      telefone: texto(body.telefone),
    });
    return NextResponse.json({ success: true, grupo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar o grupo.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await apagarGrupo(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível excluir o grupo.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
