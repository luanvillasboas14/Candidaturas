import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Candidatura, CandidaturaInput } from '@/types/candidatura';
import { findContactByPhone } from './crm-dna';
import { readEnv } from './env';

let supabaseServer: SupabaseClient | null = null;

function getSupabaseServer(): SupabaseClient {
  if (supabaseServer) {
    return supabaseServer;
  }

  const supabaseUrl = readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada.');
  }

  supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseServer;
}

export async function insertCandidatura(
  input: CandidaturaInput
): Promise<Candidatura> {
  const contact = await findContactByPhone(input.telefone_normalizado);

  const { data, error } = await getSupabaseServer()
    .from('candidaturas')
    .insert({
      telefone: input.telefone,
      telefone_normalizado: input.telefone_normalizado,
      job_id: input.job_id,
      vaga_endereco: input.vaga_endereco,
      contact_id: contact?.id || null,
      deal_candidatura_id: crypto.randomUUID(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Nenhuma candidatura retornada após o INSERT.');
  }

  return data as Candidatura;
}

export async function countOtherCandidaturas(
  telefoneNormalizado: string,
  excludeJobId: string
): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from('candidaturas')
    .select('*', { count: 'exact', head: true })
    .eq('telefone_normalizado', telefoneNormalizado)
    .neq('job_id', excludeJobId);

  if (error) {
    throw error;
  }

  return count || 0;
}

export interface TrackerLeadRecord {
  id: string;
  telefone: string;
  telefone_normalizado: string;
  origem: string | null;
  campanha: string | null;
  headline: string | null;
  ctwa_clid: string | null;
  fbclid: string | null;
  gclid: string | null;
  referrer: string | null;
}

export async function getTrackerLeadByPhone(
  telefoneNormalizado: string
): Promise<TrackerLeadRecord | null> {
  const { data, error } = await getSupabaseServer()
    .from('tracker_leads')
    .select(
      'id, telefone, telefone_normalizado, origem, campanha, headline, ctwa_clid, fbclid, gclid, referrer'
    )
    .eq('telefone_normalizado', telefoneNormalizado)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function upsertTrackerLead(input: {
  telefone: string;
  telefone_normalizado: string;
  origem: string | null;
  campanha: string | null;
  headline: string | null;
  ctwa_clid: string | null;
  fbclid: string | null;
  gclid: string | null;
  referrer: string | null;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: existing, error: selectError } = await supabase
    .from('tracker_leads')
    .select('id')
    .eq('telefone_normalizado', input.telefone_normalizado)
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;

  const payload = {
    telefone: input.telefone,
    telefone_normalizado: input.telefone_normalizado,
    origem: input.origem,
    campanha: input.campanha,
    headline: input.headline,
    ctwa_clid: input.ctwa_clid,
    fbclid: input.fbclid,
    gclid: input.gclid,
    referrer: input.referrer,
  };

  if (existing?.id) {
    const { error } = await supabase.from('tracker_leads').update(payload).eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('tracker_leads').insert(payload);
  if (error) throw error;
}

export interface TrackerLeadRow {
  id: string;
  telefone: string;
  telefone_normalizado: string;
  origem: string | null;
  campanha: string | null;
  headline: string | null;
  referrer: string | null;
  created_at: string;
}

export async function updateTrackerLeadCampaign(
  telefoneNormalizado: string,
  campanha: string
): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('tracker_leads')
    .update({ campanha })
    .eq('telefone_normalizado', telefoneNormalizado);
  if (error) throw error;
}

export async function listTrackerLeads(range?: {
  from?: string | null;
  to?: string | null;
}): Promise<TrackerLeadRow[]> {
  let query = getSupabaseServer()
    .from('tracker_leads')
    .select('id, telefone, telefone_normalizado, origem, campanha, headline, referrer, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (range?.from) {
    query = query.gte('created_at', `${range.from}T00:00:00.000-03:00`);
  }
  if (range?.to) {
    query = query.lte('created_at', `${range.to}T23:59:59.999-03:00`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TrackerLeadRow[];
}

export type AlunoCepRow = {
  rgm: string;
  telefone: string;
  cep: string | null;
  bairro: string | null;
  lat: number | null;
  lng: number | null;
};

export async function countAlunosCep(): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from('alunos_cep')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

export async function listAlunosCepLocalizacoes(): Promise<
  Array<{ telefone: string; bairro: string | null; lat: number | null; lng: number | null }>
> {
  const rows: Array<{ telefone: string; bairro: string | null; lat: number | null; lng: number | null }> =
    [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getSupabaseServer()
      .from('alunos_cep')
      .select('telefone, bairro, lat, lng')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(
      ...data.map((row) => ({
        telefone: row.telefone,
        bairro: row.bairro,
        lat: row.lat == null ? null : Number(row.lat),
        lng: row.lng == null ? null : Number(row.lng),
      }))
    );
    if (data.length < pageSize) break;
  }
  return rows;
}

export async function listAlunosCepTelefones(): Promise<string[]> {
  const telefones: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getSupabaseServer()
      .from('alunos_cep')
      .select('telefone')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    telefones.push(...data.map((row) => row.telefone));
    if (data.length < pageSize) break;
  }
  return telefones;
}

export async function upsertAlunosCep(rows: AlunoCepRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await getSupabaseServer().from('alunos_cep').upsert(
    rows.map((row) => ({
      ...row,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'telefone' }
  );
  if (error) throw error;
}

export async function listTelefonesComVagaEnviada(vagaId: string): Promise<string[]> {
  const telefones: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getSupabaseServer()
      .from('alunos_cep')
      .select('telefone')
      .contains('vaga_enviada', [vagaId])
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    telefones.push(...data.map((row) => row.telefone));
    if (data.length < pageSize) break;
  }
  return telefones;
}

export async function appendVagaEnviada(
  alunos: Array<{ rgm: string; telefone: string }>,
  vagaId: string
): Promise<number> {
  const unicos = new Map<string, string>();
  for (const aluno of alunos) {
    if (!aluno.telefone || unicos.has(aluno.telefone)) continue;
    unicos.set(aluno.telefone, aluno.rgm);
  }
  if (!unicos.size) return 0;

  const telefones = [...unicos.keys()];
  const atuais = new Map<string, string[]>();
  const pageSize = 200;
  for (let i = 0; i < telefones.length; i += pageSize) {
    const chunk = telefones.slice(i, i + pageSize);
    const { data, error } = await getSupabaseServer()
      .from('alunos_cep')
      .select('telefone, rgm, vaga_enviada')
      .in('telefone', chunk);
    if (error) throw error;
    for (const row of data || []) {
      atuais.set(row.telefone, Array.isArray(row.vaga_enviada) ? row.vaga_enviada : []);
      if (row.rgm) unicos.set(row.telefone, row.rgm);
    }
  }

  const rows = telefones.map((telefone) => {
    const atuaisVagas = atuais.get(telefone) || [];
    return {
      rgm: unicos.get(telefone) || telefone,
      telefone,
      vaga_enviada: atuaisVagas.includes(vagaId) ? atuaisVagas : [...atuaisVagas, vagaId],
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await getSupabaseServer()
    .from('alunos_cep')
    .upsert(rows, { onConflict: 'telefone' });
  if (error) throw error;
  return rows.length;
}

export async function deleteAlunosCepByTelefones(telefones: string[]): Promise<number> {
  if (!telefones.length) return 0;
  let removed = 0;
  const pageSize = 200;
  for (let i = 0; i < telefones.length; i += pageSize) {
    const chunk = telefones.slice(i, i + pageSize);
    const { data, error } = await getSupabaseServer()
      .from('alunos_cep')
      .delete()
      .in('telefone', chunk)
      .select('telefone');
    if (error) throw error;
    removed += data?.length || 0;
  }
  return removed;
}
