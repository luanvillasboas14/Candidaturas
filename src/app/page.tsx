import Image from 'next/image';
import { CandidaturaForm } from '@/components/CandidaturaForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { listJobs } from '@/lib/supabase';
import { JobOption } from '@/types/candidatura';

export default async function HomePage() {
  let jobs: JobOption[] = [];
  let errorMessage = '';

  try {
    jobs = await listJobs();
  } catch (error) {
    errorMessage = 'Não foi possível carregar as vagas no momento.';
  }

  return (
    <main className="container">
      <div className="card">
        <div className="card-header">
          <div className="logo-wrapper">
            <Image
              src="/logo-dna.png"
              alt="DNA Work"
              width={160}
              height={48}
              priority
              className="logo"
            />
          </div>
          <ThemeToggle />
        </div>

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
