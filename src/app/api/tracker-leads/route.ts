import { NextResponse } from 'next/server';
import { CrmApiError } from '@/lib/crm-dna';
import { getContactTrackingByPhone } from '@/lib/crm-tracking';
import { normalizePhone } from '@/lib/phone';
import { upsertTrackerLead } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const telefoneRaw = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const telefoneNormalizado = normalizePhone(telefoneRaw);

    if (!telefoneNormalizado) {
      return NextResponse.json(
        { success: false, message: 'Telefone é obrigatório e precisa ser válido.' },
        { status: 400 }
      );
    }

    const tracking = await getContactTrackingByPhone(telefoneNormalizado);
    if (!tracking) {
      return NextResponse.json(
        { success: false, message: 'Não encontrei esse telefone no CRM.' },
        { status: 404 }
      );
    }

    await upsertTrackerLead({
      telefone: telefoneRaw,
      telefone_normalizado: telefoneNormalizado,
      ...tracking,
    });

    return NextResponse.json({
      success: true,
      message: 'Origem do lead gravada.',
      tracker: {
        telefone: telefoneRaw,
        telefone_normalizado: telefoneNormalizado,
        ...tracking,
      },
    });
  } catch (error) {
    if (error instanceof CrmApiError) {
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

    console.error('Erro ao gravar tracker_leads:', error);
    return NextResponse.json(
      { success: false, message: 'Erro inesperado ao gravar a origem do lead.' },
      { status: 500 }
    );
  }
}
