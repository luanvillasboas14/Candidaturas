export type NivelFormacao =
  | 'Ensino fundamental'
  | 'Ensino médio'
  | 'Técnico'
  | 'Superior'
  | 'Pós-graduação'
  | 'Mestrado'
  | 'Doutorado';

export type StatusFormacao = 'Completo' | 'Incompleto' | 'Cursando' | 'Trancado';

export type NivelIdioma = 'Básico' | 'Intermediário' | 'Avançado' | 'Fluente' | 'Nativo';

export type ModeloCurriculo =
  | 'classico'
  | 'moderno'
  | 'lateral'
  | 'direita'
  | 'compacto'
  | 'ats'
  | 'executivo'
  | 'timeline'
  | 'minimal';

export type CorCurriculo =
  | 'laranja'
  | 'azul'
  | 'verde'
  | 'vinho'
  | 'grafite'
  | 'roxo'
  | 'vermelho'
  | 'rosa'
  | 'ciano'
  | 'mostarda'
  | 'marinho'
  | 'terracota'
  | 'oliva'
  | 'preto';

export type Formacao = {
  id: string;
  nivel: NivelFormacao;
  curso: string;
  instituicao: string;
  inicio: string;
  fim: string;
  status: StatusFormacao;
};

export type Experiencia = {
  id: string;
  empresa: string;
  cargo: string;
  cidade: string;
  inicio: string;
  fim: string;
  atual: boolean;
  atividades: string;
};

export type Idioma = {
  id: string;
  idioma: string;
  nivel: NivelIdioma;
};

export type Certificacao = {
  id: string;
  nome: string;
  emissor: string;
  ano: string;
};

export type Curriculo = {
  nome: string;
  foto: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  bairro: string;
  nascimento: string;
  formacoes: Formacao[];
  experiencias: Experiencia[];
  competencias: string[];
  idiomas: Idioma[];
  certificacoes: Certificacao[];
  afiliacoes: string;
  conquistas: string;
  informacoes: string;
  sites: string;
  objetivo: string;
};

export const NIVEIS_FORMACAO: NivelFormacao[] = [
  'Ensino fundamental',
  'Ensino médio',
  'Técnico',
  'Superior',
  'Pós-graduação',
  'Mestrado',
  'Doutorado',
];

export function formacaoSemCurso(nivel: NivelFormacao) {
  return nivel === 'Ensino fundamental' || nivel === 'Ensino médio';
}

export function statusDaFormacao(nivel: NivelFormacao): StatusFormacao[] {
  if (formacaoSemCurso(nivel)) return ['Completo', 'Incompleto', 'Cursando'];
  return ['Completo', 'Cursando', 'Trancado'];
}

export const NIVEIS_IDIOMA: NivelIdioma[] = ['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo'];

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
