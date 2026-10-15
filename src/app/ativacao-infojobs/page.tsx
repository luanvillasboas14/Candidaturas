import { redirect } from 'next/navigation';

const PAINEL_INFOJOBS = 'https://dnaworkia-disparador-infojobs.vkfaze.easypanel.host/';

export default function AtivacaoInfojobsPage() {
  redirect(PAINEL_INFOJOBS);
}
