import { VagasProximasForm } from '@/vagas-proximas/VagasProximasForm';

export default function HomePage() {
  return (
    <main className="container">
      <div className="card card-wide nearby-page">
        <h1>Vagas próximas</h1>
        <p className="subtitle">
          Informe o CEP. Nos filtros, ajuste a distância, o sexo e a idade. Depois selecione o que vai no texto para o candidato.
        </p>
        <VagasProximasForm />
      </div>
    </main>
  );
}
