import { CandidaturaForm } from '@/components/CandidaturaForm';
import { listJobs } from '@/lib/supabase';
import { JobOption } from '@/types/candidatura';

export default async function CandidaturasPage() {
  let jobs: JobOption[] = [];
  let errorMessage = '';

  try {
    jobs = await listJobs();
  } catch (error) {
    console.error('Erro ao carregar vagas:', error);
    errorMessage = 'Não foi possível carregar as vagas no momento.';
  }

  return (
    <main className="container">
      <div className="card">
        <h1>Nova candidatura</h1>
        <p className="subtitle">
          Registre o interesse de um candidato em uma vaga.
        </p>

        {errorMessage ? (
          <div className="message error">{errorMessage}</div>
        ) : (
          <CandidaturaForm jobs={jobs} />
        )}
      </div>
    </main>
  );
}
