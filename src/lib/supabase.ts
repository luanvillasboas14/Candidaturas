import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { JobOption } from '@/types/candidatura';
import { readEnv } from './env';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readEnv('SUPABASE_ANON_KEY') || readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

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
  contractType: string;
  salaryMin: number;
  salaryMax: number;
  salaryRange: string;
  benefits: string;
  codigo: string;
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
    .select('id, source_job_id, title, company_name, location, city, state, contract_type, salary_min, salary_max, salary_range, benefits, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) {
    throw new Error(`Erro ao buscar vagas: ${error.message}`);
  }

  const { data: jobCodes, error: codesError } = await getSupabase()
    .from('jobs')
    .select('id, codigo');

  if (codesError) {
    throw new Error(`Erro ao buscar códigos das vagas: ${codesError.message}`);
  }

  const codigoById = new Map(
    (jobCodes || [])
      .filter((row) => row.id && row.codigo)
      .map((row) => [String(row.id), String(row.codigo).trim()])
  );

  return (data || []).map((job) => {
    const sourceId = job.source_job_id || job.id;
    return {
      id: sourceId,
      title: job.title || 'Vaga sem título',
      company: job.company_name || 'Empresa não informada',
      location: job.location || `${job.city || ''} ${job.state || ''}`.trim() || 'Local não informado',
      contractType: typeof job.contract_type === 'string' ? job.contract_type : '',
      salaryMin: Number(job.salary_min) || 0,
      salaryMax: Number(job.salary_max) || 0,
      salaryRange: typeof job.salary_range === 'string' ? job.salary_range.trim() : '',
      benefits: typeof job.benefits === 'string' ? job.benefits.trim() : '',
      codigo: codigoById.get(String(sourceId)) || '',
      latitude: Number(job.latitude),
      longitude: Number(job.longitude),
    };
  }).filter((job) => Number.isFinite(job.latitude) && Number.isFinite(job.longitude));
}
