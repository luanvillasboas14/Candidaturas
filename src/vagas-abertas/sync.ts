import { getDnaWorkPool } from '@/lib/dna-work-db';
import { getSupabaseServer } from '@/lib/supabase-server';

type Linha = Record<string, unknown>;

export type EmpresaAviso = {
  empresaId: string;
  nome: string;
  cnpj: string;
  vagas: number;
};

function texto(valor: unknown): string {
  return valor == null ? '' : String(valor).trim();
}

export async function listarEmpresasPendentes(): Promise<EmpresaAviso[]> {
  const pool = getDnaWorkPool();
  const [linhas] = await pool.query(
    `select v.id_empresa, e.nome_fantasia, e.razao_social, e.cnpj, count(*) as vagas
     from vaga v
     inner join empresa e on e.id_empresa = v.id_empresa
     where e.sede = 10 and v.status = 0
     group by v.id_empresa, e.nome_fantasia, e.razao_social, e.cnpj`
  );
  const grupos = linhas as Linha[];
  if (!grupos.length) return [];
  const supabase = getSupabaseServer();
  const ids = grupos.map((linha) => texto(linha.id_empresa)).filter(Boolean);
  const existentes = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error } = await supabase.from('empresa').select('id').in('id', lote);
    if (error) throw new Error(error.message);
    for (const empresa of data || []) existentes.add(String(empresa.id));
  }
  return grupos
    .flatMap((linha) => {
      const empresaId = texto(linha.id_empresa);
      if (!empresaId || existentes.has(empresaId)) return [];
      return [
        {
          empresaId,
          nome: texto(linha.nome_fantasia) || texto(linha.razao_social) || 'Empresa sem nome',
          cnpj: texto(linha.cnpj),
          vagas: Number(linha.vagas) || 0,
        },
      ];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
