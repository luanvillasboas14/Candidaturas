# Regras e contexto para agentes — Candidaturas

Sistema interno DNA Work. Cada página tem a própria pasta de código e um arquivo em `docs/` com o que ela usa.

## Como atualizar a documentação
Quando criar ou alterar rota, tabela, variável de ambiente ou regra de negócio, atualize o `docs/` da página correspondente. O que acontece fora do GitHub (n8n, EasyPanel, CRM, SQL no Supabase) vai em `docs/fora-do-github.md`.

## Páginas
- [Vagas próximas](docs/vagas-proximas.md) — `/`
- [Candidaturas](docs/candidaturas.md) — `/candidaturas`
- [Só contrato](docs/so-contrato.md) — `/so-contrato`
- [Origem](docs/origem.md) — `/origem`
- [Ativação Cruzeiro](docs/ativacao-cruzeiro.md) — `/ativacao-cruzeiro`
- [Fora do GitHub](docs/fora-do-github.md) — n8n, EasyPanel, CRM, Supabase

## Stack
- Next.js 15 App Router e TypeScript.
- Server Components para layout; listas e gravações passam por API routes.
- Client Components só para formulário/dashboard (`'use client'`).
- Supabase: anon key no frontend, service role key só no backend.
- Telefone sempre normalizado para E.164 (`55DDNNNNNNNN`).
- A aba lateral navega entre Vagas próximas, Candidaturas, Só contrato, Origem e Ativação Cruzeiro. A home abre em Vagas próximas.

## Variáveis de ambiente obrigatórias
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRM_DNA_API_URL` — `https://integrations.bwipo.com`
- `CRM_DNA_API_TOKEN`
- `CRM_DNA_OWNER_KETOLYN_ID` (opcional; Só contrato)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` — Postgres Cruzeiro (`dcz_sync`)

## Compartilhado
- `src/components/` — shell, tema.
- `src/lib/` — env, phone, supabase, CRM DNA.
- `src/types/candidatura.ts` — tipos das vagas/candidatura.
