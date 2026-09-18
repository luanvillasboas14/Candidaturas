import { NextResponse } from 'next/server';
import { CrmApiError } from '@/lib/crm-dna';
import { saveDealCampaign } from '@/origem/crm-deal-campaign';
import { getInfojobsDealTracking } from '@/origem/crm-deal-origin';
import { resolveCampaignLabelFromReferrer } from '@/origem/campaign-from-image';
import { getContactTrackingById, getContactTrackingByPhone } from '@/origem/crm-tracking';
import type { ContactTracking } from '@/origem/crm-tracking';
import { isAdsOrigem, mergeLeadTracking } from '@/origem/lead-origin';
import { normalizePhone } from '@/lib/phone';
import {
  getTrackerLeadByPhone,
  updateTrackerLeadCampaign,
  upsertTrackerLead,
} from '@/lib/supabase-server';

const ACCEPTED_EVENTS = new Set(['deal_created', 'contact_created']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function parseWebhookBody(body: unknown): {
  event: string | null;
  contactId: string | null;
  dealId: string | null;
  telefone: string | null;
  origem: string | null;
  campanha: string | null;
} {
  const root = asRecord(body) || {};
  const data = asRecord(root.data) || {};
  const contact = asRecord(root.contact) || asRecord(data.contact) || {};
  const deal = asRecord(root.deal) || asRecord(data.deal) || {};

  return {
    event: readText(root.event),
    contactId: readText(root.contactId, data.contactId, contact.id),
    dealId: readText(root.dealId, data.dealId, deal.id),
    telefone: readText(
      root.telefone,
      root.phone,
      data.telefone,
      data.phone,
      contact.telefone,
      contact.phone
    ),
    origem: readText(root.origem, root.source, data.origem, data.source),
    campanha: readText(root.campanha, root.campaign, data.campanha, data.campaign),
  };
}

function trackingFromRow(
  row: {
    origem: string | null;
    campanha: string | null;
    headline: string | null;
    ctwa_clid: string | null;
    fbclid: string | null;
    gclid: string | null;
    referrer: string | null;
  } | null
): ContactTracking | null {
  if (!row) return null;
  return {
    origem: row.origem,
    campanha: row.campanha,
    headline: row.headline,
    ctwa_clid: row.ctwa_clid,
    fbclid: row.fbclid,
    gclid: row.gclid,
    referrer: row.referrer,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseWebhookBody(body);
    const {
      event,
      contactId,
      dealId,
      telefone,
      origem: origemInformada,
      campanha: campanhaInformada,
    } = parsed;

    if (event && !ACCEPTED_EVENTS.has(event)) {
      return NextResponse.json({ success: true, ignored: true, event });
    }

    let crmTracking: ContactTracking & { telefone?: string } | null = null;
    try {
      crmTracking = contactId
        ? await getContactTrackingById(contactId)
        : telefone
          ? await getContactTrackingByPhone(telefone)
          : null;
    } catch (error) {
      if (!telefone || !(origemInformada || campanhaInformada)) throw error;
      console.warn('CRM indisponível; gravando origem enviada no webhook:', error);
    }

    const telefoneRaw = crmTracking?.telefone || telefone || '';
    const telefoneNormalizado = normalizePhone(telefoneRaw);

    if (!telefoneNormalizado) {
      return NextResponse.json(
        { success: false, message: 'Não encontrei o telefone do lead no CRM.' },
        { status: 404 }
      );
    }

    const [existing, infojobsTracking] = await Promise.all([
      getTrackerLeadByPhone(telefoneNormalizado),
      origemInformada || isAdsOrigem(crmTracking?.origem)
        ? Promise.resolve(null)
        : getInfojobsDealTracking({ dealId, contactId }),
    ]);

    const tracking = mergeLeadTracking(
      trackingFromRow(existing),
      mergeLeadTracking(
        mergeLeadTracking(crmTracking, infojobsTracking),
        {
          origem: origemInformada,
          campanha: campanhaInformada,
          headline: null,
          ctwa_clid: null,
          fbclid: null,
          gclid: null,
          referrer: null,
        }
      )
    );

    await upsertTrackerLead({
      telefone: telefoneRaw,
      telefone_normalizado: telefoneNormalizado,
      origem: tracking.origem,
      campanha: tracking.campanha,
      headline: tracking.headline,
      ctwa_clid: tracking.ctwa_clid,
      fbclid: tracking.fbclid,
      gclid: tracking.gclid,
      referrer: tracking.referrer,
    });

    const dealTarget = {
      telefone: telefoneRaw,
      contactId,
      dealId,
      origem: tracking.origem,
    };

    if (tracking.campanha) {
      void saveDealCampaign({ ...dealTarget, campanha: tracking.campanha }).catch((error) => {
        console.warn('Falha ao gravar a campanha no negócio:', error);
      });
    }

    if (tracking.referrer && isAdsOrigem(tracking.origem)) {
      void resolveCampaignLabelFromReferrer(tracking.referrer, tracking.headline)
        .then(async (label) => {
          if (!label) return;
          if (label !== tracking.campanha) {
            await updateTrackerLeadCampaign(telefoneNormalizado, label);
          }
          await saveDealCampaign({ ...dealTarget, campanha: label });
        })
        .catch((error) => {
          console.warn('Falha ao nomear a campanha pela foto:', error);
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Origem do lead gravada.',
      tracker: {
        telefone: telefoneRaw,
        telefone_normalizado: telefoneNormalizado,
        origem: tracking.origem,
        campanha: tracking.campanha,
        headline: tracking.headline,
        ctwa_clid: tracking.ctwa_clid,
        fbclid: tracking.fbclid,
        gclid: tracking.gclid,
        referrer: tracking.referrer,
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

    const detail =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : null;
    console.error('Erro no webhook lead-criado:', error);
    return NextResponse.json(
      {
        success: false,
        message: detail
          ? `Erro ao gravar a origem do lead: ${detail}`
          : 'Erro inesperado ao gravar a origem do lead.',
      },
      { status: 500 }
    );
  }
}
