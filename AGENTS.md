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
- [Banco de Candidatos](docs/banco-candidatos.md) — `/banco-candidatos`
- [Fora do GitHub](docs/fora-do-github.md) — n8n, EasyPanel, CRM, Supabase

## Stack
- Next.js 15 App Router e TypeScript.
- Server Components para layout; listas e gravações passam por API routes.
- Client Components só para formulário/dashboard (`'use client'`).
- Supabase: anon key no frontend, service role key só no backend.
- Telefone sempre normalizado para E.164 (`55DDNNNNNNNN`).
- A aba lateral navega entre Vagas próximas, Candidaturas, Só contrato, Origem, Ativação Cruzeiro e Banco de Candidatos. A home abre em Vagas próximas.

## Variáveis de ambiente obrigatórias
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRM_DNA_API_URL` — `https://integrations.bwipo.com`
- `CRM_DNA_API_TOKEN`
- `CRM_DNA_OWNER_KETOLYN_ID` (opcional; Só contrato)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` — Postgres Cruzeiro (`dcz_sync`)
- `DNA_WORK_DB_HOST`, `DNA_WORK_DB_PORT`, `DNA_WORK_DB_USER`, `DNA_WORK_DB_PASS`, `DNA_WORK_DB_NAME` — MySQL legado `dna_work` (Lightsail/RDS). Só no `.env` / EasyPanel.
- `DNA_WORK_OPERATOR_USER` (opcional) — usuário gravado em `contratos_gerados` / `log_diversos` na demissão
- `ZAPSIGN_API_TOKEN`, `ZAPSIGN_API_URL` — envelope de assinatura. Só no `.env` / EasyPanel.
- `ZAPSIGN_USER_TOKEN` (opcional) — assinatura automática da DNA; vazio = envio das outras partes segue
- `ZAPSIGN_AGENTE_ID` (opcional, padrão `127`)

## Compartilhado
- `src/components/` — shell, tema.
- `src/lib/` — env, phone, supabase, CRM DNA.
- `src/types/candidatura.ts` — tipos das vagas/candidatura.
