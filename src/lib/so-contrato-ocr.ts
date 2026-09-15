import { normalizePhone } from './phone';

export interface ExtractedCandidate {
  nome: string;
  telefone: string;
}

export interface OcrLine {
  text: string;
  confidence?: number;
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
    'contrato',
    'amigos',
    'nitro',
    'mensagens',
    'discord',
  ].map((word) => fold(word))
);

const JOB_WORDS = new Set(
  [
    'estagiario',
    'estagiário',
    'estagiaria',
    'estagiária',
    'estagio',
    'estágio',
    'loja',
    'clt',
    'auxiliar',
    'atendente',
    'operador',
    'operadora',
    'vendedor',
    'vendedora',
    'aprendiz',
  ].map((word) => fold(word))
);

const NAME_CHUNKS = [
  'santos',
  'silva',
  'costa',
  'lima',
  'nunes',
  'alves',
  'oliveira',
  'souza',
  'soares',
  'pereira',
  'ferreira',
  'rodrigues',
  'almeida',
  'carvalho',
  'araujo',
  'ribeiro',
  'martins',
  'rocha',
  'dias',
  'moreira',
  'mendes',
  'barbosa',
  'cardoso',
  'teixeira',
  'marques',
  'machado',
  'correia',
  'vieira',
  'monteiro',
  'gomes',
  'campos',
  'melo',
  'andrade',
  'nascimento',
  'freitas',
  'pinto',
  'brito',
  'assis',
  'mariano',
  'sanches',
  'garcias',
  'feliciano',
  'henrique',
  'gabriel',
  'rafael',
  'lucas',
  'mateus',
  'matheus',
  'pedro',
  'paulo',
  'carlos',
  'maria',
  'heloisa',
  'marianne',
  'kaike',
  'kaio',
  'hugo',
  'lais',
];

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

function isMobileBr(digits: string): boolean {
  const normalized = normalizePhone(digits);
  if (!normalized) return false;
  const local = normalized.slice(2);
  return local.length === 11 && local[2] === '9';
}

function extractPhones(text: string): string[] {
  const withoutCnpj = text.replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, ' ');
  const compact = withoutCnpj.replace(/[^\d]/g, ' ');
  const matches = compact.match(/\d{10,13}/g) || [];
  const phones: string[] = [];

  for (const raw of matches) {
    if (/^\d{14}$/.test(raw)) continue;
    if (!isMobileBr(raw)) continue;
    const normalized = normalizePhone(raw);
    if (!normalized) continue;
    if (!phones.includes(normalized)) phones.push(normalized);
  }

  return phones;
}

function stripJobTitles(text: string): string {
  return text
    .replace(/estagi[aá]ri[oa]s?(?:\s*loja)?/gi, ' ')
    .replace(/est[aá]gio(?:\s*loja)?/gi, ' ')
    .replace(/\b(?:auxiliar|atendente|operador[a]?|vendedor[a]?|aprendiz)(?:\s*loja)?\b/gi, ' ');
}

function splitGluedToken(token: string): string {
  const lower = fold(token);
  if (lower.length < 12) return token;
  const cuts = new Set<number>([0, lower.length]);
  const chunks = [...NAME_CHUNKS].sort((a, b) => b.length - a.length);
  for (const chunk of chunks) {
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(chunk, from);
      if (index === -1) break;
      if (index > 1) cuts.add(index);
      cuts.add(index + chunk.length);
      from = index + chunk.length;
    }
  }
  const points = [...cuts].sort((a, b) => a - b);
  if (points.length <= 2) return token;
  const pieces: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const piece = token.slice(points[i], points[i + 1]);
    if (piece) pieces.push(piece);
  }
  return pieces.length > 1 ? pieces.join(' ') : token;
}

function cleanName(raw: string): string {
  let text = stripJobTitles(raw)
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, ' ')
    .replace(/(?:\+?55)?\s*\(?\d{2}\)?\s*9?\d{4}[-\s.]?\d{4}/g, ' ')
    .replace(/\d{1,2}:\d{2}(?:h)?(?:\s*(?:as|às|ate|até)\s*\d{1,2}:\d{2}(?:h)?)?/gi, ' ')
    .replace(/\b(?:r\$|rs)\s*\d+[.,]?\d*/gi, ' ')
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/([a-zà-ú])([A-ZÀ-Ú])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const particles = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
  const words = text.split(' ').flatMap((word) => splitGluedToken(word).split(' '));
  const filtered = words.filter((word) => {
    const key = fold(word);
    if (!key || key.length === 1) return false;
    if (key === 'rs' || key === 'as') return false;
    if (HEADER_WORDS.has(key) || JOB_WORDS.has(key)) return false;
    return /[\p{L}]/u.test(word);
  });

  text = filtered.join(' ').replace(/\s+/g, ' ').trim();
  if (filtered.length < 2) return '';
  return text
    .split(' ')
    .map((word, index) => {
      const key = fold(word);
      if (index > 0 && particles.has(key)) return key;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function nameScore(nome: string): number {
  const words = nome.trim().split(/\s+/);
  let score = words.length * 2 + Math.min(nome.length, 40);
  if (words.length === 1) score -= 8;
  if (JOB_WORDS.has(fold(nome.replace(/\s+/g, '')))) score -= 12;
  return score;
}

function addCandidate(
  found: ExtractedCandidate[],
  seen: Map<string, number>,
  nome: string,
  phoneDigits: string
) {
  const cleaned = cleanName(nome);
  if (!cleaned) return;
  const key = phoneDigits;
  const person = { nome: cleaned, telefone: displayPhone(phoneDigits) };
  const existingIndex = seen.get(key);
  if (existingIndex === undefined) {
    seen.set(key, found.length);
    found.push(person);
    return;
  }
  if (nameScore(person.nome) > nameScore(found[existingIndex].nome)) {
    found[existingIndex] = person;
  }
}

function peopleFromLines(text: string): ExtractedCandidate[] {
  const found: ExtractedCandidate[] = [];
  const seen = new Map<string, number>();

  for (const line of text.split(/\r?\n/)) {
    const phones = extractPhones(line);
    if (phones.length === 0) continue;
    addCandidate(found, seen, line, phones[phones.length - 1]);
  }

  return found;
}

function peopleFromOcrLines(lines: OcrLine[]): ExtractedCandidate[] {
  const found: ExtractedCandidate[] = [];
  const seen = new Map<string, number>();

  for (const line of lines) {
    if ((line.confidence ?? 80) < 25) continue;
    const phones = extractPhones(line.text);
    if (phones.length === 0) continue;
    addCandidate(found, seen, line.text, phones[phones.length - 1]);
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
      const nome = cleanName(trimmed);
      if (nome && !names.includes(nome)) names.push(nome);
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

export function extractCandidatesFromText(text: string, lines: OcrLine[] = []): ExtractedCandidate[] {
  const fromOcrLines = peopleFromOcrLines(lines);
  const fromTextLines = peopleFromLines(text);
  const merged: ExtractedCandidate[] = [];
  const seen = new Map<string, number>();
  for (const person of [...fromOcrLines, ...fromTextLines]) {
    const digits = normalizePhone(person.telefone);
    if (!digits) continue;
    addCandidate(merged, seen, person.nome, digits);
  }
  if (merged.length > 0) return merged;
  return peopleFromColumns(text);
}

export function mergeCandidateGroups(groups: ExtractedCandidate[][]): ExtractedCandidate[] {
  const merged: ExtractedCandidate[] = [];
  const seen = new Map<string, number>();
  for (const group of groups) {
    for (const person of group) {
      const digits = normalizePhone(person.telefone);
      if (!digits) continue;
      addCandidate(merged, seen, person.nome, digits);
    }
  }
  return merged;
}
