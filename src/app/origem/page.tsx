import { OrigemDashboard } from '@/origem/OrigemDashboard';

export default function OrigemPage() {
  return (
    <main className="container container-dashboard">
      <div className="card card-dashboard">
        <h1>Origem dos candidatos</h1>
        <p className="subtitle">
          Visão dos leads gravados em tracker_leads: canal, campanha e entradas recentes.
        </p>
        <OrigemDashboard />
      </div>
    </main>
  );
}
