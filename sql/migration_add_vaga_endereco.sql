-- Migration: adicionar coluna vaga_endereco na tabela candidaturas
-- Executar no SQL Editor do Supabase DNA

ALTER TABLE public.candidaturas
  ADD COLUMN IF NOT EXISTS vaga_endereco TEXT;

COMMENT ON COLUMN public.candidaturas.vaga_endereco IS 'Descrição legível da vaga e endereço no momento da candidatura (ex: "Desenvolvedor Front-end — São Paulo - SP").';

-- Preencher registros existentes com base na tabela jobs
UPDATE public.candidaturas c
SET vaga_endereco = COALESCE(j.title, 'Vaga sem título') || ' — ' || COALESCE(j.location, 'Local não informado')
FROM public.jobs j
WHERE c.job_id = j.id
  AND c.vaga_endereco IS NULL;
