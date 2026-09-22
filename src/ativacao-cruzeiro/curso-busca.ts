const STOP_WORDS = new Set([
  'a',
  'as',
  'o',
  'os',
  'e',
  'em',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'para',
  'cst',
  'ead',
]);

const ALIASES: Record<string, string[]> = {
  adm: ['administracao'],
  ads: ['analise e desenvolvimento de sistemas'],
  rh: ['recursos humanos'],
  gti: ['gestao da tecnologia da informacao'],
  ti: ['tecnologia da informacao'],
  si: ['sistemas de informacao'],
  cc: ['ciencia da computacao', 'ciencias contabeis'],
  ef: ['educacao fisica'],
  edf: ['educacao fisica'],
  edfis: ['educacao fisica'],
  ped: ['pedagogia'],
  fisio: ['fisioterapia'],
  nutri: ['nutricao'],
  enf: ['enfermagem'],
  farma: ['farmacia'],
  bio: ['biomedicina', 'ciencias biologicas'],
  civil: ['engenharia civil'],
  mec: ['engenharia mecanica'],
  elet: ['engenharia eletrica'],
  prod: ['engenharia de producao'],
  ri: ['relacoes internacionais'],
  rp: ['relacoes publicas'],
  publi: ['publicidade e propaganda'],
  adsistemas: ['analise e desenvolvimento de sistemas'],
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function significantWords(curso: string): string[] {
  return fold(curso)
    .split(' ')
    .filter((word) => word && !STOP_WORDS.has(word));
}

function initials(words: string[]): string {
  return words.map((word) => word[0] || '').join('');
}

export function buscarCursos(cursos: string[], termo: string, limite = 40): string[] {
  const query = fold(termo);
  if (!query) return cursos.slice(0, limite);

  const expansions = ALIASES[query.replace(/\s+/g, '')] || ALIASES[query] || [];
  const compactQuery = query.replace(/\s+/g, '');

  const ranked = cursos
    .map((curso) => {
      const folded = fold(curso);
      const compact = folded.replace(/\s+/g, '');
      const words = significantWords(curso);
      const sigla = initials(words);
      const lastTwo = words.length >= 2 ? initials(words.slice(-2)) : '';
      let score = 0;

      if (folded === query || compact === compactQuery) score = 100;
      else if (folded.startsWith(query)) score = 90;
      else if (sigla === compactQuery || lastTwo === compactQuery) score = 85;
      else if (expansions.some((alias) => folded.includes(alias))) score = 80;
      else if (folded.includes(query) || compact.includes(compactQuery)) score = 70;
      else if (sigla.startsWith(compactQuery) && compactQuery.length >= 2) score = 60;
      else if (words.some((word) => word.startsWith(query) && query.length >= 3)) score = 55;
      else return null;

      return { curso, score };
    })
    .filter((item): item is { curso: string; score: number } => item != null)
    .sort((a, b) => b.score - a.score || a.curso.localeCompare(b.curso, 'pt-BR'));

  return ranked.slice(0, limite).map((item) => item.curso);
}
