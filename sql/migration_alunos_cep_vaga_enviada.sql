-- Migration: vaga_enviada em alunos_cep
-- Executar no SQL Editor do projeto DNA Work (moemgftlmncdqfvzscmq)
-- Guarda os IDs das vagas já enviadas para o aluno. A mesma vaga não entra de novo.

ALTER TABLE public.alunos_cep
  ADD COLUMN IF NOT EXISTS vaga_enviada TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS alunos_cep_vaga_enviada_idx
  ON public.alunos_cep USING GIN (vaga_enviada);
