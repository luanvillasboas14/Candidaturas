import { NextResponse } from 'next/server';
import { campaignDisplayName } from '@/origem/campaign-label';
import { listTrackerLeads } from '@/lib/supabase-server';

function label(value: string | null | undefined, empty: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : empty;
}

function readDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = readDate(url.searchParams.get('from'));
    const to = readDate(url.searchParams.get('to'));
    const rows = await listTrackerLeads({ from, to });
    const total = rows.length;

    const origemCount = new Map<string, number>();
    const campanhaCount = new Map<string, number>();

    for (const row of rows) {
      const origem = label(row.origem, 'Sem origem');
      origemCount.set(origem, (origemCount.get(origem) || 0) + 1);

      const campanha = campaignDisplayName(row.campanha, row.headline);
      const campanhaKey = `${origem}||${campanha}`;
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

    return NextResponse.json({
      success: true,
      total,
      origens,
      campanhas,
    });
  } catch (error) {
    console.error('Erro ao listar tracker_leads:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao carregar a origem dos candidatos.' },
      { status: 500 }
    );
  }
}
