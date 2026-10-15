-- Tipo de vaga (CLT ou estágio) e o tipo da passagem.
-- Executar no SQL Editor do Supabase DNA (moemgftlmncdqfvzscmq).

ALTER TABLE public.tracker_leads
  ADD COLUMN IF NOT EXISTS tipo_vaga text;

ALTER TABLE public.tracker_ganhos
  ADD COLUMN IF NOT EXISTS tipo_vaga text;

ALTER TABLE public.tracker_ganhos
  ADD COLUMN IF NOT EXISTS passagem text;

UPDATE public.tracker_ganhos
SET passagem = CASE
  WHEN deal_id LIKE 'ganho:%' THEN 'ganho'
  WHEN deal_id LIKE 'seletivo:%' THEN 'seletivo'
  WHEN deal_id LIKE 'enviada:%' THEN 'enviada'
  ELSE passagem
END
WHERE passagem IS NULL;
