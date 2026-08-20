-- Migration: criação da tabela candidaturas no Supabase DNA
-- Executar no SQL Editor do projeto DNA Work (moemgftlmncdqfvzscmq)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.candidaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  telefone_normalizado TEXT NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  contact_id TEXT NULL,
  deal_candidatura_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'nova',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Proteção definitiva contra duplicidade: mesmo candidato + mesma vaga
  CONSTRAINT uq_candidaturas_telefone_job UNIQUE (telefone_normalizado, job_id)
);

CREATE INDEX IF NOT EXISTS idx_candidaturas_job_id ON public.candidaturas(job_id);
CREATE INDEX IF NOT EXISTS idx_candidaturas_telefone_normalizado ON public.candidaturas(telefone_normalizado);
CREATE INDEX IF NOT EXISTS idx_candidaturas_deal_candidatura_id ON public.candidaturas(deal_candidatura_id);

COMMENT ON TABLE public.candidaturas IS 'Registro de candidaturas de candidatos a vagas do DNA Work.';
COMMENT ON COLUMN public.candidaturas.telefone_normalizado IS 'Telefone no formato E.164 (ex: 5511999999999) usado na constraint de unicidade.';
COMMENT ON COLUMN public.candidaturas.deal_candidatura_id IS 'ID do negócio no CRM Candidaturas; preenchido posteriormente via n8n.';

-- Opcional: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidaturas_updated_at ON public.candidaturas;
CREATE TRIGGER trg_candidaturas_updated_at
BEFORE UPDATE ON public.candidaturas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
