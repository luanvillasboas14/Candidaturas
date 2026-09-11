import { VagasProximasForm } from '@/components/VagasProximasForm';

export default function VagasProximasPage() {
  return (
    <main className="container">
      <div className="card card-wide">
        <h1>Vagas próximas</h1>
        <p className="subtitle">
          Informe o CEP da pessoa e o raio para listar as vagas mais próximas.
        </p>
        <VagasProximasForm />
      </div>
    </main>
  );
}
