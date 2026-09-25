export type AlunoCruzeiro = {
  pessoaId: string;
  nome: string;
  curso: string;
  serie: string;
  idade: number | null;
  polo: string;
  celular: string;
  telefone: string;
  bairro: string;
  distanciaKm?: number | null;
};

export type OpcoesAtivacao = {
  cursos: string[];
  series: string[];
  sexos: Array<{ valor: string; label: string }>;
};

export type FiltrosAtivacao = {
  idadeMin?: number;
  idadeMax?: number;
  curso?: string | string[];
  serie?: string | string[];
  sexo?: string;
  bairro?: string;
  cep?: string;
  lat?: number;
  lng?: number;
  raioKm?: number;
  vagaId?: string;
  quantidade?: number;
  pessoaIds?: string[];
  page?: number;
  pageSize?: number;
};
