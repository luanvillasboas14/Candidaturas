-- ID do anúncio da Meta. Executar no SQL Editor do Supabase DNA.

ALTER TABLE public.tracker_leads
  ADD COLUMN IF NOT EXISTS ad_id text;

ALTER TABLE public.tracker_ganhos
  ADD COLUMN IF NOT EXISTS ad_id text;
