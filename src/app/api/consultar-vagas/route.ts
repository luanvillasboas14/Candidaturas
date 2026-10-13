import { NextResponse } from 'next/server';
import { listarConsultas, marcarConsulta, reabrirConsulta } from '@/consultar-vagas/consulta';
import { STATUS_CONSULTA, type StatusConsulta } from '@/consultar-vagas/tipos';

export const runtime = 'nodejs';

function texto(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lista = await listarConsultas({
      cargo: url.searchParams.get('cargo') || '',
      empresaId: url.searchParams.get('empresaId') || '',
      status: url.searchParams.get('status') || '',
    });
    return NextResponse.json({ success: true, ...lista });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível consultar as vagas.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (texto(body.acao) === 'reabrir') {
      await reabrirConsulta(texto(body.id));
      return NextResponse.json({ success: true });
    }
    const status = texto(body.status);
    if (!STATUS_CONSULTA.includes(status as StatusConsulta)) {
      return NextResponse.json({ success: false, message: 'Escolha o status.' }, { status: 400 });
    }
    await marcarConsulta(texto(body.id), status as StatusConsulta);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível marcar a vaga.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
