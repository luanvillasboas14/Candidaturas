-- Migration: alterar constraint de unicidade para usar vaga_endereco
-- Isso impede duplicidade quando a mesma vaga (mesmo título + endereço) tem IDs diferentes.
-- Executar no SQL Editor do Supabase DNA

-- 1. Remover constraint antiga baseada em job_id
ALTER TABLE public.candidaturas
  DROP CONSTRAINT IF EXISTS uq_candidaturas_telefone_job;

-- 2. Criar nova constraint baseada em telefone + vaga_endereco
ALTER TABLE public.candidaturas
  ADD CONSTRAINT uq_candidaturas_telefone_vaga_endereco UNIQUE (telefone_normalizado, vaga_endereco);

-- 3. Atualizar comentário
COMMENT ON CONSTRAINT uq_candidaturas_telefone_vaga_endereco ON public.candidaturas IS 'Impede que o mesmo candidato se candidate duas vezes à mesma vaga (mesmo título + endereço), mesmo que os IDs das vagas sejam diferentes.';
