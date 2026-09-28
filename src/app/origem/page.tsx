import { OrigemDashboard } from '@/origem/OrigemDashboard';

export default function OrigemPage() {
  return (
    <main className="container container-dashboard container-cv">
      <div className="card card-dashboard card-cv">
        <h1>Origem dos candidatos</h1>
        <p className="subtitle">
          Leads de tracker_leads e ganhos de tracker_ganhos no mesmo período: canal, campanha e quem entrou em Ganho.
        </p>
        <OrigemDashboard />
      </div>
    </main>
  );
}
