import { OrigemDashboard } from '@/origem/OrigemDashboard';

export default function OrigemPage() {
  return (
    <main className="container container-dashboard container-cv">
      <div className="card card-dashboard card-cv">
        <h1>Origem dos candidatos</h1>
        <p className="subtitle">
          Quem entrou em Lead de entrada, quem passou por Processo seletivo realizado e quem entrou em Ganho. CLT ou estágio entra quando a pessoa chega em Atendimento IA.
        </p>
        <OrigemDashboard />
      </div>
    </main>
  );
}
