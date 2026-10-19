import { sincronizarVagasAbertas } from './sync';

const marca = globalThis as { vagaSyncAgendado?: boolean; vagaSyncSlot?: string };

function parte(agora: Date, tipo: Intl.DateTimeFormatPartTypes): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  return Number(partes.find((item) => item.type === tipo)?.value || '0');
}

export function slotDe(agora = new Date()): string {
  const hora = Math.floor(parte(agora, 'hour') / 6) * 6;
  const mes = String(parte(agora, 'month')).padStart(2, '0');
  const dia = String(parte(agora, 'day')).padStart(2, '0');
  return `${parte(agora, 'year')}-${mes}-${dia}-${String(hora).padStart(2, '0')}`;
}

function msAteProximoSlot(agora = new Date()): number {
  const hora = parte(agora, 'hour');
  const minuto = parte(agora, 'minute');
  const segundo = parte(agora, 'second');
  const proxima = Math.floor(hora / 6) * 6 + 6;
  const horas = proxima >= 24 ? 24 - hora : proxima - hora;
  const ms = ((horas * 60 - minuto) * 60 - segundo) * 1000;
  return Math.max(ms, 1000);
}

async function ciclo(): Promise<void> {
  try {
    const slot = slotDe();
    if (marca.vagaSyncSlot !== slot) {
      await sincronizarVagasAbertas(slot);
      marca.vagaSyncSlot = slot;
    }
  } catch (error) {
    console.error('[vagas-abertas]', error instanceof Error ? error.message : error);
  }
  setTimeout(() => {
    void ciclo();
  }, msAteProximoSlot());
}

export function agendarSyncVagas(): void {
  if (marca.vagaSyncAgendado) return;
  marca.vagaSyncAgendado = true;
  void ciclo();
}
