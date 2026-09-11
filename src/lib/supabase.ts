import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { JobOption } from '@/types/candidatura';
import { readEnv } from './env';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL e anon key devem estar configurados.');
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export interface JobGeo {
  id: string;
  title: string;
  company: string;
  location: string;
  latitude: number;
  longitude: number;
}

export async function listJobs(): Promise<JobOption[]> {
  const { data, error } = await getSupabase()
    .from('jobs')
    .select('id, title, company_name, location, city, state');

  if (error) {
    throw new Error(`Erro ao buscar vagas: ${error.message}`);
  }

  return (data || []).map((job) => ({
    id: job.id,
    title: job.title || 'Vaga sem título',
    company: job.company_name || 'Empresa não informada',
    location: job.location || `${job.city || ''} ${job.state || ''}`.trim() || 'Local não informado',
  }));
}

export async function listActiveJobsForGeo(): Promise<JobGeo[]> {
  const { data, error } = await getSupabase()
    .from('jobs_enriched')
    .select('id, source_job_id, title, company_name, location, city, state, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) {
    throw new Error(`Erro ao buscar vagas: ${error.message}`);
  }

  return (data || []).map((job) => ({
    id: job.source_job_id || job.id,
    title: job.title || 'Vaga sem título',
    company: job.company_name || 'Empresa não informada',
    location: job.location || `${job.city || ''} ${job.state || ''}`.trim() || 'Local não informado',
    latitude: Number(job.latitude),
    longitude: Number(job.longitude),
  })).filter((job) => Number.isFinite(job.latitude) && Number.isFinite(job.longitude));
}
