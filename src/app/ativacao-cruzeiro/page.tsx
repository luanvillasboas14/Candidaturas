import { AtivacaoCruzeiroDashboard } from '@/ativacao-cruzeiro/AtivacaoCruzeiroDashboard';

export default function AtivacaoCruzeiroPage() {
  return (
    <main className="container container-dashboard">
      <div className="card card-dashboard">
        <h1>Ativação Cruzeiro</h1>
        <p className="subtitle">
          Alunos de graduação do último snapshot de matriculados, sem repetir a mesma pessoa. A lista
          só aparece depois de algum filtro. Variações do mesmo curso entram juntas.
        </p>
        <AtivacaoCruzeiroDashboard />
      </div>
    </main>
  );
}
