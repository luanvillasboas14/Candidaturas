import { CandidatoDetalheDashboard } from '@/banco-candidatos/CandidatoDetalheDashboard';

export default async function BancoCandidatoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vaga?: string }>;
}) {
  const { id } = await params;
  const { vaga } = await searchParams;
  return (
    <main className="container container-dashboard">
      <div className="card card-dashboard">
        <h1>Banco de Candidatos</h1>
        <p className="subtitle">Detalhe do candidato. Demissão de estágio gera a Rescisão estágio ensino médio.</p>
        <CandidatoDetalheDashboard idCandidato={id} idVaga={vaga} />
      </div>
    </main>
  );
}
