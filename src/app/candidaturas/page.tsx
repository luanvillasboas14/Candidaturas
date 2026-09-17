import { CandidaturaForm } from '@/candidaturas/CandidaturaForm';

export default function CandidaturasPage() {
  return (
    <main className="container">
      <div className="card">
        <h1>Nova candidatura</h1>
        <p className="subtitle">
          Registre o interesse de um candidato em uma vaga.
        </p>
        <CandidaturaForm />
      </div>
    </main>
  );
}
