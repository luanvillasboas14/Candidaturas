import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Candidatura, CandidaturaInput } from '@/types/candidatura';
import { findContactByPhone } from './crm-dna';
import { readEnv } from './env';

let supabaseServer: SupabaseClient | null = null;

function getSupabaseServer(): SupabaseClient {
  if (supabaseServer) {
    return supabaseServer;
  }

  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
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
