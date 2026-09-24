export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function brToIso(value: string): string | undefined {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function hrefDetalhe(idCandidato: string, idVaga?: string | null): string {
  const base = `/banco-candidatos/${encodeURIComponent(idCandidato)}`;
  return idVaga ? `${base}?vaga=${encodeURIComponent(idVaga)}` : base;
}

/** O legado grava itens de `atribu_contrato` colados (`balcãoReposição`). */
export function normalizarResumoAtividades(value: string | null | undefined): string {
  if (!value) return '';
  let text = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\t+/g, '\n');

  text = text.replace(/([a-zàáâãéêíóôõúç])([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/gu, '$1\n$2');
  text = text.replace(/([.!?])([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/gu, '$1\n$2');
  text = text.replace(/([^\s\n])(\d+\.\s)/g, '$1\n$2');

  return text
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
