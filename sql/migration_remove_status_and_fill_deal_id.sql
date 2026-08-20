-- Migration: remover coluna status e preencher deal_candidatura_id com UUID único
-- Executar no SQL Editor do Supabase DNA

-- 1. Preencher registros existentes com um UUID aleatório único
UPDATE public.candidaturas
SET deal_candidatura_id = gen_random_uuid()::text
WHERE deal_candidatura_id IS NULL;

-- 2. Tornar a coluna obrigatória e garantir unicidade
ALTER TABLE public.candidaturas
  ALTER COLUMN deal_candidatura_id SET NOT NULL;

ALTER TABLE public.candidaturas
  ADD CONSTRAINT uq_candidaturas_deal_candidatura_id UNIQUE (deal_candidatura_id);

-- 3. Remover a coluna status
ALTER TABLE public.candidaturas
  DROP COLUMN IF EXISTS status;

-- 4. Comentário atualizado
COMMENT ON COLUMN public.candidaturas.deal_candidatura_id IS 'Identificador único da candidatura (UUID). Será substituído pelo ID do negócio no CRM quando o n8n processar.';
