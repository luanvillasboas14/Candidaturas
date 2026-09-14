export interface Candidatura {
  id: string;
  telefone: string;
  telefone_normalizado: string;
  job_id: string;
  vaga_endereco: string;
  contact_id: string | null;
  deal_candidatura_id: string;
  created_at: string;
  updated_at: string;
}

export interface CandidaturaInput {
  telefone: string;
  telefone_normalizado: string;
  job_id: string;
  vaga_endereco: string;
}

export interface CandidaturaResponse {
  success: boolean;
  candidatura?: Candidatura;
  code?: string;
  message: string;
  hasOtherCandidaturas?: boolean;
  otherCandidaturasCount?: number;
}

export interface JobOption {
  id: string;
  title: string;
  company: string;
  location: string;
}

export type JobContractType = 'CLT' | 'Estágio';

export interface NearbyJob {
  id: string;
  title: string;
  company: string;
  location: string;
  contractType: JobContractType;
  salaryLabel: string;
  hasBenefits: boolean;
  schedule: string;
  distanceKm: number;
}
