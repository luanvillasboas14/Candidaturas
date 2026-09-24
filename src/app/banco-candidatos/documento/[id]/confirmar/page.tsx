import { ConfirmarAssinatura } from '@/banco-candidatos/ConfirmarAssinatura';

export default async function ConfirmarAssinaturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConfirmarAssinatura idContrato={id} />;
}
