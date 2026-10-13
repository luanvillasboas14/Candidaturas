import { NextResponse } from 'next/server';
import { listTrackerGanhos, listTrackerLeads, type TrackerLeadRow } from '@/lib/supabase-server';
import { campaignDisplayName, isNamedCampaign } from '@/origem/campaign-label';
import { listEntradasCrm, type EntradaCrm } from '@/origem/crm-entradas';
import { clampOrigemRange } from '@/origem/date-range';
import { mergeLeadTracking } from '@/origem/lead-origin';

export const maxDuration = 3600;

function label(value: string | null | undefined, empty: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : empty;
}

function readDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function juntarEntradas(entradas: EntradaCrm[], rows: TrackerLeadRow[]) {
  const porTelefone = new Map(rows.map((row) => [row.telefone_normalizado, row]));
  const contas: Array<{ origem: string | null; campanha: string | null; headline: string | null }> =
    [];

  for (const entrada of entradas) {
    const lead = entrada.telefoneNormalizado
      ? porTelefone.get(entrada.telefoneNormalizado)
      : undefined;
    const junto = lead
      ? mergeLeadTracking(entrada, {
          origem: lead.origem,
          campanha: lead.campanha,
          headline: lead.headline,
          ctwa_clid: null,
          fbclid: null,
          gclid: null,
          referrer: lead.referrer,
        })
      : entrada;
    contas.push({
      origem: junto.origem,
      campanha: junto.campanha,
      headline: junto.headline || lead?.headline || null,
    });
  }

  return contas;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { from, to } = clampOrigemRange(
      readDate(url.searchParams.get('from')),
      readDate(url.searchParams.get('to'))
    );
    const [entradas, rows, ganhoRows] = await Promise.all([
      listEntradasCrm({ from, to }),
      listTrackerLeads({ from, to }),
      listTrackerGanhos({ from, to }).catch((error) => {
        console.error('Erro ao listar tracker_ganhos:', error);
        return [];
      }),
    ]);
    const contas = juntarEntradas(entradas, rows);
    const total = contas.length;

    const origemCount = new Map<string, number>();
    const campanhaCount = new Map<string, number>();

    for (const row of contas) {
      const origem = label(row.origem, 'Sem origem');
      origemCount.set(origem, (origemCount.get(origem) || 0) + 1);

      const campanha = campaignDisplayName(row.campanha, row.headline);
      const nome = isNamedCampaign(campanha) ? campanha : 'Sem campanha';
      const campanhaKey = `${origem}||${nome}`;
      campanhaCount.set(campanhaKey, (campanhaCount.get(campanhaKey) || 0) + 1);
    }

    const origens = Array.from(origemCount.entries())
      .map(([nome, quantidade]) => ({
        nome,
        quantidade,
        percentual: total ? Number(((quantidade / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const campanhas = Array.from(campanhaCount.entries())
      .map(([key, quantidade]) => {
        const [origem, campanha] = key.split('||');
        return { origem, campanha, quantidade };
      })
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 12);

    const ganhoCount = new Map<string, number>();
    for (const row of ganhoRows) {
      const origem = label(row.origem, 'Sem origem');
      const campanha = campaignDisplayName(row.campanha, null);
      const nome = isNamedCampaign(campanha) ? campanha : 'Sem campanha';
      const key = `${origem}||${nome}`;
      ganhoCount.set(key, (ganhoCount.get(key) || 0) + 1);
    }

    const ganhosCampanhas = Array.from(ganhoCount.entries())
      .map(([key, quantidade]) => {
        const [origem, campanha] = key.split('||');
        return { origem, campanha, quantidade };
      })
      .sort((a, b) => b.quantidade - a.quantidade);

    return NextResponse.json({
      success: true,
      total,
      origens,
      campanhas,
      ganhos: {
        total: ganhoRows.length,
        campanhas: ganhosCampanhas,
      },
    });
  } catch (error) {
    console.error('Erro ao listar tracker_leads:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao carregar a origem dos candidatos.' },
      { status: 500 }
    );
  }
}
