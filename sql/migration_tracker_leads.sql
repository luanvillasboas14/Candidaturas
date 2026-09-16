-- Migration: criação da tabela tracker_leads no Supabase DNA
-- Executar no SQL Editor do projeto DNA Work (moemgftlmncdqfvzscmq)

CREATE TABLE IF NOT EXISTS public.tracker_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  telefone_normalizado TEXT NOT NULL,
  origem TEXT NULL,
  campanha TEXT NULL,
  headline TEXT NULL,
  ctwa_clid TEXT NULL,
  fbclid TEXT NULL,
  gclid TEXT NULL,
  referrer TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
