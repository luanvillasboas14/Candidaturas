import { DocumentoPrint } from '@/banco-candidatos/DocumentoPrint';

export default async function DocumentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentoPrint idContrato={id} />;
}
