export interface JobOption {
  id: string;
  title: string;
  company: string;
  location: string;
  bairro?: string;
  cep?: string;
  contractType?: string;
  lat?: number | null;
  lng?: number | null;
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
  schedules: string[];
  distanceKm: number;
}
