import { normalizePhone } from './phone';

export interface ExtractedCandidate {
  nome: string;
  telefone: string;
}

const HEADER_WORDS = new Set(
  [
    'cnpj',
    'loja',
    'nome',
    'funcao',
    'funcão',
    'função',
    'horario',
    'horário',
    'bolsa',
    'data',
    'inicio',
    'início',
    'contato',
    'estagiario',
    'estagiário',
    'estagio',
    'estágio',
    'clt',
    'contrato',
  ].map((word) => fold(word))
);

const JOB_WORDS = new Set(
  ['estagiario', 'estagiário', 'estagio', 'estágio', 'loja', 'clt'].map((word) => fold(word))
);

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function displayPhone(digits: string): string {
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

function extractPhones(text: string): string[] {
  const compact = text.replace(/[^\d]/g, ' ');
  const matches = compact.match(/\d{10,13}/g) || [];
  const phones: string[] = [];

  for (const raw of matches) {
    if (/^\d{14}$/.test(raw)) continue;
    const normalized = normalizePhone(raw);
    if (!normalized) continue;
    if (!phones.includes(normalized)) phones.push(normalized);
  }

  return phones;
}

function cleanName(raw: string): string {
  let text = raw
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, ' ')
    .replace(/(?:\+?55)?\s*\(?\d{2}\)?\s*9?\d{4}[-\s.]?\d{4}/g, ' ')
    .replace(/\d{1,2}:\d{2}(?:h)?(?:\s*(?:as|às|ate|até)\s*\d{1,2}:\d{2}(?:h)?)?/gi, ' ')
    .replace(/\b(?:r\$|rs)\s*\d+[.,]?\d*/gi, ' ')
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const particles = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
  const words = text.split(' ').filter((word) => {
    const key = fold(word);
    if (!key || key.length === 1) return false;
    if (key === 'rs' || key === 'as') return false;
    if (HEADER_WORDS.has(key) || JOB_WORDS.has(key)) return false;
    return /[\p{L}]/u.test(word);
  });

  text = words.join(' ').replace(/\s+/g, ' ').trim();
  if (words.length < 2) return '';
  return text
    .split(' ')
    .map((word, index) => {
      const key = fold(word);
      if (index > 0 && particles.has(key)) return key;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function peopleFromLines(text: string): ExtractedCandidate[] {
  const found: ExtractedCandidate[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const phones = extractPhones(line);
    if (phones.length === 0) continue;
    const nome = cleanName(line);
    if (!nome) continue;
    const telefone = displayPhone(phones[0]);
    const key = `${fold(nome)}|${phones[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ nome, telefone });
  }

  return found;
}

function peopleFromColumns(text: string): ExtractedCandidate[] {
  const names: string[] = [];
  const phones: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const linePhones = extractPhones(trimmed);
    if (linePhones.length > 0) {
      for (const phone of linePhones) {
        if (!phones.includes(phone)) phones.push(phone);
      }
      continue;
    }
    const nome = cleanName(trimmed);
    if (nome && !names.includes(nome)) names.push(nome);
  }

  const count = Math.min(names.length, phones.length);
  const found: ExtractedCandidate[] = [];
  for (let i = 0; i < count; i += 1) {
    found.push({ nome: names[i], telefone: displayPhone(phones[i]) });
  }
  return found;
}

export function extractCandidatesFromText(text: string): ExtractedCandidate[] {
  const fromLines = peopleFromLines(text);
  if (fromLines.length > 0) return fromLines;
  return peopleFromColumns(text);
}
