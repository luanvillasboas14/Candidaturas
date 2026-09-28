import { GeradorCurriculo } from '@/gerador-curriculo/GeradorCurriculo';

export default function GeradorCurriculoPage() {
  return (
    <main className="container container-dashboard container-cv">
      <div className="card card-dashboard card-cv">
        <h1>Gerador de currículo</h1>
        <p className="subtitle">
          Escolha o modelo no começo, preencha todas as etapas e baixe o PDF. No final dá para trocar o modelo.
        </p>
        <GeradorCurriculo />
      </div>
    </main>
  );
}
