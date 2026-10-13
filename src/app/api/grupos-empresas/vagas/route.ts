import { NextResponse } from 'next/server';
import { apagarVaga, atualizarVaga, criarVaga, lerVaga, listarRepetidas, listarVagas } from '@/grupos-empresas/vaga';

export const runtime = 'nodejs';

function texto(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function entrada(body: Record<string, unknown>) {
  return {
    empresaId: texto(body.empresaId),
    tipoVaga: texto(body.tipoVaga),
    quantidade: texto(body.quantidade),
    cargo: texto(body.cargo),
    bolsa: texto(body.bolsa),
    cargaHoraria: texto(body.cargaHoraria),
    periodo: texto(body.periodo),
    diaDe: texto(body.diaDe),
    diaAte: texto(body.diaAte),
    entrada: texto(body.entrada),
    intervaloHoras: texto(body.intervaloHoras),
    intervaloMinutos: texto(body.intervaloMinutos),
    dias: body.dias ?? null,
    escolaridade: texto(body.escolaridade),
    sexo: texto(body.sexo),
    idade: texto(body.idade),
    idadeAte: texto(body.idadeAte),
    km: texto(body.km),
    atividades: texto(body.atividades),
    tempoHoras: texto(body.tempoHoras),
    tempoMinutos: texto(body.tempoMinutos),
    beneficios: texto(body.beneficios),
    conducoes: texto(body.conducoes),
    folgasFixas: texto(body.folgasFixas),
    jornada: texto(body.jornada),
    tipoTrabalho: texto(body.tipoTrabalho),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const repetidas = url.searchParams.get('repetidas');
    if (repetidas) {
      const modelos = await listarRepetidas(repetidas);
      return NextResponse.json({ success: true, modelos });
    }
    const id = url.searchParams.get('id');
    if (id) {
      const vaga = await lerVaga(id);
      return NextResponse.json({ success: true, vaga });
    }
    const vagas = await listarVagas();
    return NextResponse.json({ success: true, vagas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível listar as vagas.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const vagas = await criarVaga(entrada(body));
    return NextResponse.json({ success: true, vagas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível abrir a vaga.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await atualizarVaga(texto(body.id), entrada(body));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível salvar a vaga.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    await apagarVaga(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível apagar a vaga.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
