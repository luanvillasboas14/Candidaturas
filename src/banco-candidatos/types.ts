export const MOTIVOS_DEMISSAO = [
  'Candidato solicitou o desligamento',
  'Empresa solicitou o desligamento',
] as const;

export type MotivoDemissao = (typeof MOTIVOS_DEMISSAO)[number];

export const AVALIACOES_DESEMPENHO = [
  'Excelente',
  'Muito bom',
  'Bom',
  'Regular',
  'Insuficiente',
] as const;

export type AvaliacaoDesempenho = (typeof AVALIACOES_DESEMPENHO)[number];

export const NOME_DOCUMENTO_RESCISAO = 'Rescisão estágio ensino médio';

export const STATUS_CANDIDATO = ['disponivel', 'encaminhado', 'contratado', 'demitido'] as const;
export type StatusCandidato = (typeof STATUS_CANDIDATO)[number];

export const STATUS_FILTRO = ['todos', ...STATUS_CANDIDATO] as const;
export type StatusFiltro = (typeof STATUS_FILTRO)[number];

export const STATUS_LABEL: Record<StatusCandidato, string> = {
  disponivel: 'Disponível',
  encaminhado: 'Encaminhado',
  contratado: 'Contratado',
  demitido: 'Demitido',
};

export function isStatusFiltro(value: string | undefined): value is StatusFiltro {
  return Boolean(value && (STATUS_FILTRO as readonly string[]).includes(value));
}

export function isStatusCandidato(value: string | undefined): value is StatusCandidato {
  return Boolean(value && (STATUS_CANDIDATO as readonly string[]).includes(value));
}

export type FormacaoOpcao = {
  id: number;
  valor: string;
};

export type ModalidadeOpcao = {
  id: number;
  descricao: string;
};

export type CandidatoLista = {
  idCandidato: string;
  status: StatusCandidato | null;
  encaminhado: boolean;
  nome: string;
  idade: number | null;
  terminoEstudo: string | null;
  tipoEnsino: string | null;
  instituicao: string | null;
  curso: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  dataCadastro: string | null;
  contratado: boolean;
  idVaga: string | null;
  tipoVaga: number | null;
  cargoVaga: string | null;
  distanciaKm: number | null;
};

export type DocumentoGerado = {
  idContrato: string;
  nome: string;
  vaga: string | null;
  cargo: string | null;
  empresa: string | null;
  data: string;
  status: string;
};

export type OcorrenciaCandidato = {
  id: string;
  descricao: string;
  data: string;
};

export type CandidatoDetalhe = CandidatoLista & {
  email: string | null;
  telefone: string | null;
  celular: string | null;
  cpf: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  empresa: string | null;
  jaDemitido: boolean;
  encaminhamentoCargo: string | null;
  encaminhamentoEmpresa: string | null;
  documentos: DocumentoGerado[];
  ocorrencias: OcorrenciaCandidato[];
  atribuicoes: string | null;
};

export type FiltrosBanco = {
  nome?: string;
  cadastroDe?: string;
  cadastroAte?: string;
  cargo?: string;
  cep?: string;
  lat?: number;
  lng?: number;
  raioKm?: number;
  formacao?: number;
  salarioMin?: number;
  salarioMax?: number;
  tipoContratacao?: number;
  status?: StatusFiltro;
  page?: number;
  pageSize?: number;
};

export type ListaBanco = {
  total: number;
  page: number;
  pageSize: number;
  usouRaio: boolean;
  candidatos: CandidatoLista[];
};
