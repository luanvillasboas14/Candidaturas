import { ConsultarVagas } from '@/consultar-vagas/ConsultarVagas';

export default function ConsultarVagasPage() {
  return (
    <main className="container container-dashboard container-cv">
      <div className="card card-dashboard card-cv">
        <h1>Consultar vagas</h1>
        <ConsultarVagas />
      </div>
    </main>
  );
}
