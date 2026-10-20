import { redirect } from 'next/navigation';

const GERADOR_TCE = 'https://dnaworkia-tce-gerador.vkfaze.easypanel.host/';

export default function GeradorTcePage() {
  redirect(GERADOR_TCE);
}
