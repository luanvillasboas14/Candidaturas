import { cnpjMascarado } from '@/grupos-empresas/validar';
import { listarEmpresasPendentes } from '@/vagas-abertas/sync';

export async function AvisoEmpresasPendentes() {
  let empresas: Awaited<ReturnType<typeof listarEmpresasPendentes>> = [];
  try {
    empresas = await listarEmpresasPendentes();
  } catch {
    return null;
  }
  if (!empresas.length) return null;
  const uma = empresas.length === 1 && empresas[0].vagas === 1;
  return (
    <aside className="message vaga-aviso" role="status">
      <p>
        {uma
          ? 'Há vaga aberta de empresa ainda não cadastrada no sistema novo.'
          : 'Há vagas abertas de empresas ainda não cadastradas no sistema novo.'}{' '}
        Cadastre a empresa, coloque no grupo certo ou crie um grupo novo.
      </p>
      <ul>
        {empresas.map((empresa) => (
          <li key={empresa.empresaId}>
            {empresa.nome} — {empresa.cnpj ? cnpjMascarado(empresa.cnpj) : 'CNPJ não informado'} — {empresa.vagas}{' '}
            {empresa.vagas === 1 ? 'vaga' : 'vagas'}
          </li>
        ))}
      </ul>
    </aside>
  );
}
