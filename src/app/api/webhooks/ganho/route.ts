import { NextResponse } from 'next/server';
import { crmRequest } from '@/lib/crm-dna';
import { normalizePhone } from '@/lib/phone';
import { getTrackerLeadByPhone, insertTrackerGanho } from '@/lib/supabase-server';
import { campaignDisplayName } from '@/origem/campaign-label';
import { getContactTrackingById } from '@/origem/crm-tracking';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

function campanhaDoNegocio(fields: unknown): string | null {
  if (!Array.isArray(fields)) return null;
  for (const field of fields) {
    const item = asRecord(field);
    if (!item) continue;
    const key = `${readText(item.name, item.slug) || ''}`.toLowerCase();
    if (!key.includes('campanha')) continue;
    const value = readText(item.value);
    if (value) return value;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const root = asRecord(body) || {};
    const data = asRecord(root.data) || {};
    const deal = asRecord(root.deal) || asRecord(data.deal) || {};
    const contact = asRecord(root.contact) || asRecord(data.contact) || {};

    const dealId = readText(root.dealId, data.dealId, deal.id);
    const contactId = readText(root.contactId, data.contactId, contact.id, deal.contactId);
    let telefone = readText(root.telefone, root.phone, data.telefone, data.phone, contact.telefone, contact.phone);
    let origem = readText(root.origem, root.source, data.origem, data.source, contact.source);
    let campanha = readText(root.campanha, root.campaign, data.campanha, data.campaign);

    if (!dealId && !telefone && !contactId) {
      return NextResponse.json(
        { success: false, message: 'Informe o dealId, o contactId ou o telefone.' },
        { status: 400 }
      );
    }

    if (dealId) {
      try {
        const detalhe = asRecord(await crmRequest<unknown>(`/api/deals/${dealId}`));
        const negocio = asRecord(detalhe?.deal) || asRecord(detalhe?.data) || detalhe;
        campanha = campanha || campanhaDoNegocio(negocio?.customFields);
        const contato = asRecord(negocio?.contact);
        telefone = telefone || readText(contato?.phone, contato?.telefone);
        origem = origem || readText(contato?.source);
      } catch (error) {
        console.warn('Não foi possível ler o negócio do ganho:', error);
      }
    }

    if (contactId && (!telefone || !campanha || !origem)) {
      try {
        const tracking = await getContactTrackingById(contactId);
        telefone = telefone || tracking?.telefone || null;
        origem = origem || tracking?.origem || null;
        campanha = campanha || tracking?.campanha || null;
      } catch (error) {
        console.warn('Não foi possível ler o contato do ganho:', error);
      }
    }

    const telefoneNormalizado = telefone ? normalizePhone(telefone) : '';
    if (!campanha && telefoneNormalizado) {
      const lead = await getTrackerLeadByPhone(telefoneNormalizado);
      campanha = lead?.campanha || lead?.headline || null;
      origem = origem || lead?.origem || null;
      telefone = telefone || lead?.telefone || null;
    }

    const campanhaVisivel = campaignDisplayName(campanha, null);
    const salvo = await insertTrackerGanho({
      deal_id: dealId,
      contact_id: contactId,
      telefone: telefone || null,
      telefone_normalizado: telefoneNormalizado || null,
      origem,
      campanha: campanhaVisivel && campanhaVisivel !== 'Sem campanha' ? campanhaVisivel : campanha,
    });

    return NextResponse.json({
      success: true,
      id: salvo.id,
      ganhoEm: salvo.ganho_em,
      dealId,
      telefone: telefoneNormalizado || null,
      origem,
      campanha: campanhaVisivel || campanha,
    });
  } catch (error) {
    console.error('Erro ao gravar ganho:', error);
    return NextResponse.json(
      { success: false, message: 'Não foi possível gravar o ganho.' },
      { status: 500 }
    );
  }
}
