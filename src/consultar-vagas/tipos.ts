export const STATUS_CONSULTA = ['contratada', 'demitida', 'cancelada'] as const;
export type StatusConsulta = (typeof STATUS_CONSULTA)[number];

export type VagaAberta = {
  id: string;
  empresaId: string;
  empresaNome: string;
  cargo: string;
  tipoVaga: number;
};

export type ConsultaRegistrada = {
  id: string;
  vagaId: string;
  empresaId: string;
  empresaNome: string;
  cargo: string;
  tipoVaga: number;
  status: StatusConsulta;
};

export type EmpresaFiltro = {
  id: string;
  nome: string;
};

export type FiltroConsulta = {
  cargo: string;
  empresaId: string;
  status: string;
};
