import { NextResponse } from 'next/server';
import { criarEmpresa, listarEmpresas } from '@/grupos-empresas/gravar';

export const runtime = 'nodejs';

function texto(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function GET() {
  try {
    const empresas = await listarEmpresas();
    return NextResponse.json({ success: true, empresas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível listar as empresas.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const empresa = await criarEmpresa({
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
    const message = error instanceof Error ? error.message : 'Não foi possível gravar a empresa.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
