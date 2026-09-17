const DNA_WORK_HOURS_URL = 'https://sistema.dnawork.ai/webhook/empresa.php';

const DAYS = [
  { label: 'Segunda', entrada: ['segunda_entrada'], saida: ['segunda_saida'] },
  { label: 'Terça', entrada: ['terca_entrada'], saida: ['terca_saida'] },
  { label: 'Quarta', entrada: ['quarta_entrada'], saida: ['quarta_saida'] },
  { label: 'Quinta', entrada: ['quinta_entrada'], saida: ['quinta_saida'] },
  { label: 'Sexta', entrada: ['sexta_entrada'], saida: ['sexta_saida'] },
  { label: 'Sábado', entrada: ['sab_entrada', 'sabado_entrada'], saida: ['sab_saida', 'sabado_saida'] },
  { label: 'Domingo', entrada: ['domingo_entrada', 'domindo_entrada'], saida: ['domingo_saida', 'domindo_saida'] },
] as const;

function readTime(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '0' || raw === '00:00') return '';
  return raw.replace('.', ':');
}

function firstTime(vaga: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const time = readTime(vaga[key]);
    if (time) return time;
  }
  return '';
}

function formatDayRange(start: string, end: string): string {
  return start === end ? start : `${start} a ${end.toLowerCase()}`;
}

function extractFolgaFromTexto(texto: unknown): string {
  const raw = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const match = raw.match(/folgas?\b[\s\S]*?(?=\.|$)/i);
  if (!match) return '';

  const phrase = match[0].replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
  if (!phrase) return '';
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function formatFolga(
  vaga: Record<string, unknown>,
  slots: Array<{ index: number; label: string }>
): string {
  const fromText = extractFolgaFromTexto(vaga.texto_carga);
  if (fromText) return fromText;

  if (slots.length > 0) {
    const worked = new Set(slots.map((slot) => slot.index));
    const start = Math.min(...worked);
    const end = Math.max(...worked);
    const missing: string[] = [];
    for (let index = start; index <= end; index += 1) {
      if (!worked.has(index)) missing.push(DAYS[index].label.toLowerCase());
    }
    if (missing.length === 1) return `Folga na ${missing[0]}`;
    if (missing.length > 1) return `Folga: ${missing.join(', ')}`;
  }

  if (slots.length >= 6) return 'com uma folga na semana';
  return '';
}

function withFolga(schedule: string, folga: string): string {
  if (!schedule) return '';
  if (!folga || /folga/i.test(schedule)) return schedule;
  return `${schedule} • ${folga}`;
}

function formatDailyHours(vaga: Record<string, unknown>): string {
  const baseIn = readTime(vaga.horabase);
  const baseOut = readTime(vaga.hora_saida_base) || readTime(vaga.hora_saidabase);
  const slots: Array<{ index: number; label: string; hours: string }> = [];

  DAYS.forEach((day, index) => {
    let entrada = firstTime(vaga, day.entrada);
    let saida = firstTime(vaga, day.saida);
    if (!entrada && !saida) return;
    if (!entrada) entrada = baseIn;
    if (!saida) saida = baseOut;
    if (!entrada || !saida) return;
    slots.push({ index, label: day.label, hours: `${entrada} às ${saida}` });
  });

  if (slots.length === 0) return '';

  const groups: Array<{ start: string; end: string; hours: string; lastIndex: number }> = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && last.hours === slot.hours && last.lastIndex + 1 === slot.index) {
      last.end = slot.label;
      last.lastIndex = slot.index;
      continue;
    }
    groups.push({
      start: slot.label,
      end: slot.label,
      hours: slot.hours,
      lastIndex: slot.index,
    });
  }

  const hours = groups
    .map((group) => `${formatDayRange(group.start, group.end)}, ${group.hours}`)
    .join(' • ');
  return withFolga(hours, formatFolga(vaga, slots));
}

function formatWeekLabel(value: unknown): string {
  const raw = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/feira/g, '')
    .trim();
  if (raw.startsWith('segunda')) return 'Segunda';
  if (raw.startsWith('terca')) return 'Terça';
  if (raw.startsWith('quarta')) return 'Quarta';
  if (raw.startsWith('quinta')) return 'Quinta';
  if (raw.startsWith('sexta')) return 'Sexta';
  if (raw.startsWith('sab')) return 'Sábado';
  if (raw.startsWith('dom')) return 'Domingo';
  return '';
}

function formatBaseHours(vaga: Record<string, unknown>): string {
  const baseIn = readTime(vaga.horabase);
  const baseOut = readTime(vaga.hora_saida_base) || readTime(vaga.hora_saidabase);
  if (!baseIn || !baseOut) return '';

  const start = formatWeekLabel(vaga.semanas_inicio);
  const end = formatWeekLabel(vaga.semanas_fim);
  const hours =
    start && end
      ? `${formatDayRange(start, end)}, ${baseIn} às ${baseOut}`
      : `${baseIn} às ${baseOut}`;
  return withFolga(hours, formatFolga(vaga, []));
}

export function formatVagaSchedule(vaga: Record<string, unknown>): string {
  return formatDailyHours(vaga) || formatBaseHours(vaga);
}

export async function listJobSchedulesByCodigo(): Promise<Map<string, string>> {
  const schedules = new Map<string, string>();

  try {
    const response = await fetch(DNA_WORK_HOURS_URL, { cache: 'no-store' });
    if (!response.ok) return schedules;

    const empresas = (await response.json()) as Array<{ vagas?: Record<string, unknown>[] }>;
    for (const empresa of empresas || []) {
      for (const vaga of empresa.vagas || []) {
        const codigo = String(vaga.codigo || '').trim();
        if (!codigo) continue;
        const schedule = formatVagaSchedule(vaga);
        if (schedule) schedules.set(codigo, schedule);
      }
    }
  } catch (error) {
    console.error('Erro ao buscar horários no DNA Work:', error);
  }

  return schedules;
}
