import { NextResponse } from 'next/server';
import { apagarEmpresa, atualizarEmpresa } from '@/grupos-empresas/gravar';

export const runtime = 'nodejs';

function texto(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const empresa = await atualizarEmpresa(id, {
      grupoId: texto(body.grupoId),
      cnpj: texto(body.cnpj),
      razaoSocial: texto(body.razaoSocial),
      nomeFantasia: texto(body.nomeFantasia),
      email: texto(body.email),
      telefone: texto(body.telefone),
      cep: texto(body.cep),
      logradouro: texto(body.logradouro),
      numero: texto(body.numero),
      complemento: texto(body.complemento),
    });
    return NextResponse.json({ success: true, empresa });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a empresa.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await apagarEmpresa(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível excluir a empresa.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
