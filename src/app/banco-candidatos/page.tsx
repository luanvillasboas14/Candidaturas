import { BancoCandidatosDashboard } from '@/banco-candidatos/BancoCandidatosDashboard';

export default function BancoCandidatosPage() {
  return (
    <main className="container container-dashboard">
      <div className="card card-dashboard">
        <h1>Banco de Candidatos</h1>
        <p className="subtitle">
          Consulta do banco de talentos em dna_work. Demitir de estágio gera um único documento: Rescisão
          estágio ensino médio.
        </p>
        <BancoCandidatosDashboard />
      </div>
    </main>
  );
}
