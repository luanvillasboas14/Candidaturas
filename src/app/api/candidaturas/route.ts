import { NextResponse } from 'next/server';
import { insertCandidatura, countOtherCandidaturas } from '@/lib/supabase-server';
import { findContactByPhone } from '@/lib/crm-dna';
import { normalizePhone } from '@/lib/phone';
import { CandidaturaResponse } from '@/types/candidatura';

const N8N_WEBHOOK_URL = 'https://dnaworkia-n8n.vkfaze.easypanel.host/webhook/criacaocandidaturas';

async function notifyN8N(payload: unknown): Promise<void> {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Webhook n8n retornou erro:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Erro ao chamar webhook n8n:', error);
  }
}

export async function POST(request: Request): Promise<NextResponse<CandidaturaResponse>> {
  try {
    const body = await request.json();
    const telefoneRaw = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
    const vagaEndereco = typeof body.vaga_endereco === 'string' ? body.vaga_endereco.trim() : '';

    if (!telefoneRaw) {
      return NextResponse.json(
        { success: false, message: 'Telefone é obrigatório.' },
        { status: 400 }
      );
    }

    if (!jobId) {
      return NextResponse.json(
        { success: false, message: 'Vaga é obrigatória.' },
        { status: 400 }
      );
    }

    if (!vagaEndereco) {
      return NextResponse.json(
        { success: false, message: 'Descrição da vaga é obrigatória.' },
        { status: 400 }
      );
    }

    const telefoneNormalizado = normalizePhone(telefoneRaw);

    if (!telefoneNormalizado) {
      return NextResponse.json(
        { success: false, message: 'Telefone informado não parece válido.' },
        { status: 400 }
      );
    }

    const contact = await findContactByPhone(telefoneNormalizado);

    const candidatura = await insertCandidatura({
      telefone: telefoneRaw,
      telefone_normalizado: telefoneNormalizado,
      job_id: jobId,
      vaga_endereco: vagaEndereco,
    });

    const otherCount = await countOtherCandidaturas(telefoneNormalizado, jobId);

    await notifyN8N({
      ...candidatura,
      contact_name: contact?.name || null,
      total_candidaturas: otherCount + 1,
      outras_candidaturas: otherCount,
    });

    return NextResponse.json(
      {
        success: true,
        candidatura,
        message: 'Candidatura criada com sucesso.',
        hasOtherCandidaturas: otherCount > 0,
        otherCandidaturasCount: otherCount,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const code = error?.code || '';
    const message = error?.message || '';

    if (code === '23505' || message.includes('unique constraint')) {
      return NextResponse.json(
        {
          success: false,
          code: 'CANDIDATURA_DUPLICADA',
          message: 'Este telefone já possui uma candidatura registrada para esta vaga.',
        },
        { status: 409 }
      );
    }

    console.error('Erro ao criar candidatura:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Erro inesperado ao criar candidatura. Tente novamente.',
      },
      { status: 500 }
    );
  }
}
