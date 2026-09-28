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
    let origemFallback = readText(root.origem, root.source, data.origem, data.source, contact.source);
    let campanhaFallback = readText(root.campanha, root.campaign, data.campanha, data.campaign);
    let headlineFallback: string | null = null;

    if (!dealId && !telefone && !contactId) {
      return NextResponse.json(
        { success: false, message: 'Informe o dealId, o contactId ou o telefone.' },
        { status: 400 }
      );
    }

    if (dealId && !telefone) {
      try {
        const detalhe = asRecord(await crmRequest<unknown>(`/api/deals/${dealId}`));
        const negocio = asRecord(detalhe?.deal) || asRecord(detalhe?.data) || detalhe;
        const contato = asRecord(negocio?.contact);
        telefone = readText(contato?.phone, contato?.telefone);
        origemFallback = origemFallback || readText(contato?.source);
        campanhaFallback = campanhaFallback || campanhaDoNegocio(negocio?.customFields);
      } catch (error) {
        console.warn('Não foi possível ler o negócio do ganho:', error);
      }
    }

    if (contactId && !telefone) {
      try {
        const tracking = await getContactTrackingById(contactId);
        telefone = tracking?.telefone || null;
        origemFallback = origemFallback || tracking?.origem || null;
        campanhaFallback = campanhaFallback || tracking?.campanha || null;
        headlineFallback = tracking?.headline || null;
      } catch (error) {
        console.warn('Não foi possível ler o contato do ganho:', error);
      }
    }

    const telefoneNormalizado = telefone ? normalizePhone(telefone) : '';
    const lead = telefoneNormalizado ? await getTrackerLeadByPhone(telefoneNormalizado) : null;

    let origem: string | null;
    let campanha: string | null;
    if (lead) {
      origem = lead.origem;
      campanha = lead.campanha || lead.headline;
      telefone = telefone || lead.telefone;
    } else {
      if (dealId && telefone && !campanhaFallback) {
        try {
          const detalhe = asRecord(await crmRequest<unknown>(`/api/deals/${dealId}`));
          const negocio = asRecord(detalhe?.deal) || asRecord(detalhe?.data) || detalhe;
          campanhaFallback = campanhaDoNegocio(negocio?.customFields);
          origemFallback = origemFallback || readText(asRecord(negocio?.contact)?.source);
        } catch (error) {
          console.warn('Não foi possível ler o negócio do ganho:', error);
        }
      }
      if (contactId && (!origemFallback || !campanhaFallback)) {
        try {
          const tracking = await getContactTrackingById(contactId);
          origemFallback = origemFallback || tracking?.origem || null;
          campanhaFallback = campanhaFallback || tracking?.campanha || null;
          headlineFallback = headlineFallback || tracking?.headline || null;
          telefone = telefone || tracking?.telefone || null;
        } catch (error) {
          console.warn('Não foi possível ler o contato do ganho:', error);
        }
      }
      origem = origemFallback;
      campanha = campanhaFallback || headlineFallback;
    }

    const campanhaVisivel = campaignDisplayName(campanha, lead?.headline || headlineFallback);
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
