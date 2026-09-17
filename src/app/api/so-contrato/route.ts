import { NextResponse } from 'next/server';
import { CrmApiError } from '@/lib/crm-dna';
import { createSoContratoDeals } from '@/so-contrato/crm-so-contrato';
import { normalizePhone } from '@/lib/phone';

interface CandidatoInput {
  nome?: unknown;
  telefone?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawList = Array.isArray(body.candidatos) ? (body.candidatos as CandidatoInput[]) : [];
    const photoName =
      typeof body.fotoNome === 'string' && body.fotoNome.trim()
        ? body.fotoNome.trim()
        : 'contrato.jpg';

    const people: { name: string; phoneDigits: string }[] = [];
    for (const item of rawList) {
      const nome = typeof item.nome === 'string' ? item.nome.trim() : '';
      const telefoneRaw = typeof item.telefone === 'string' ? item.telefone.trim() : '';
      if (!nome || !telefoneRaw) continue;
      const phoneDigits = normalizePhone(telefoneRaw);
      if (!phoneDigits) {
        return NextResponse.json(
          { success: false, message: `Telefone inválido: ${telefoneRaw}` },
          { status: 400 }
        );
      }
      people.push({ name: nome, phoneDigits });
    }

    if (people.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nenhum candidato válido para criar.' },
        { status: 400 }
      );
    }

    const results = await createSoContratoDeals({ people, photoName });
    const created = results.filter((item) => item.createdNewDeal).length;
    const updated = results.length - created;
    const parts: string[] = [];
    if (created > 0) {
      parts.push(`${created} ${created === 1 ? 'lead criado' : 'leads criados'}`);
    }
    if (updated > 0) {
      parts.push(
        `${updated} ${updated === 1 ? 'já existia e foi atualizado' : 'já existiam e foram atualizados'}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `${parts.join('. ')}.`,
      results,
    });
  } catch (error) {
    if (error instanceof CrmApiError) {
      console.error('CRM Só contrato:', error.status, error.message);
      return NextResponse.json(
        {
          success: false,
          message:
            error.status >= 500
              ? 'O CRM está indisponível no momento. Tente novamente.'
              : error.message,
        },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }

    const message = error instanceof Error ? error.message : 'Erro inesperado ao criar os leads.';
    console.error('Erro ao criar Só contrato:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
