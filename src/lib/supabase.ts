import { createClient } from '@supabase/supabase-js';
import { JobOption } from '@/types/candidatura';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e anon key devem estar configurados.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function listJobs(): Promise<JobOption[]> {
  const { data, error } = await supabase
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
