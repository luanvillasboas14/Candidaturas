-- Ganhos por campanha. Cada entrada no estágio Ganho gera uma linha nova.
-- O mesmo lead pode ganhar mais de uma vez. Executar no SQL Editor do Supabase DNA.

CREATE TABLE IF NOT EXISTS public.tracker_ganhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NULL,
  contact_id TEXT NULL,
  telefone TEXT NULL,
  telefone_normalizado TEXT NULL,
  origem TEXT NULL,
  campanha TEXT NULL,
  ganho_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracker_ganhos_ganho_em_idx ON public.tracker_ganhos (ganho_em DESC);
CREATE INDEX IF NOT EXISTS tracker_ganhos_deal_id_idx ON public.tracker_ganhos (deal_id);
