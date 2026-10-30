export function slotDe(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((item) => item.type === tipo)?.value || '0');
  const hora = Math.floor(valor('hour') / 6) * 6;
  const mes = String(valor('month')).padStart(2, '0');
  const dia = String(valor('day')).padStart(2, '0');
  return `${valor('year')}-${mes}-${dia}-${String(hora).padStart(2, '0')}`;
}

export function agendarSyncVagas(): void {
  return;
}
