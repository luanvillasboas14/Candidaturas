import { GruposEmpresas } from '@/grupos-empresas/GruposEmpresas';

export default function GruposEmpresasPage() {
  return (
    <main className="container container-dashboard container-cv">
      <div className="card card-dashboard card-cv">
        <h1>Grupos e empresas</h1>
        <GruposEmpresas />
      </div>
    </main>
  );
}
