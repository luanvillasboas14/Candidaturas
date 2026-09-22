-- Migration: alunos_cep no Supabase DNA
-- Executar no SQL Editor do projeto DNA Work (moemgftlmncdqfvzscmq)
-- Uma row por telefone. Várias matrículas do mesmo aluno (mesmo telefone) = um CEP.

CREATE TABLE IF NOT EXISTS public.alunos_cep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rgm TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cep TEXT NULL,
  bairro TEXT NULL,
  lat DOUBLE PRECISION NULL,
  lng DOUBLE PRECISION NULL,
  vaga_enviada TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT alunos_cep_telefone_unico UNIQUE (telefone)
);

CREATE INDEX IF NOT EXISTS alunos_cep_rgm_idx ON public.alunos_cep (rgm);
CREATE INDEX IF NOT EXISTS alunos_cep_cep_idx ON public.alunos_cep (cep);
