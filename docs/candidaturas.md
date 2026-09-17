# Candidaturas

Rota da tela: `/candidaturas`.

## O que faz
Registra o interesse de um candidato a partir do telefone e do `job_id`. Duplicidade é protegida no banco via `UNIQUE(telefone_normalizado, vaga_endereco)`. O frontend não consulta antes de tentar criar. `vaga_endereco` guarda a descrição legível no momento da candidatura (ex: "Desenvolvedor Front-end — São Paulo - SP"). `deal_candidatura_id` nasce com `crypto.randomUUID()` e é UNIQUE; o n8n troca pelo ID real do negócio. A coluna `status` foi removida. A API devolve `hasOtherCandidaturas` e `otherCandidaturasCount` quando o mesmo telefone já tem candidatura em outra vaga.

Antes do INSERT, o backend busca `contact_id` no CRM DNA (`GET /api/contacts?phone=...`). Se não achar, fica `null`. Depois do INSERT, chama o webhook n8n de criação de candidatura. Se o INSERT falhar, o webhook não é chamado.

## Arquivos desta página
- `src/app/candidaturas/page.tsx` — tela.
- `src/candidaturas/CandidaturaForm.tsx` — formulário.
- `src/app/api/candidaturas/route.ts` — `POST` de criação.
- `src/app/api/vagas/route.ts` — `GET` da lista de vagas do formulário.
- `src/lib/supabase-server.ts` — INSERT com service role.
- `src/lib/phone.ts` — normalização E.164.
- `src/lib/crm-dna.ts` — busca de contato.
- `sql/migration_candidaturas.sql` — tabela.

## Regras
- Unicidade operacional: `(telefone_normalizado, job_id)` no fluxo atual; o banco também trava `(telefone_normalizado, vaga_endereco)`.
- A página não tem autenticação por enquanto.
- A tabela `candidaturas` fica no mesmo Supabase DNA que `jobs`.

## Fora desta pasta
Webhook n8n `https://dnaworkia-n8n.vkfaze.easypanel.host/webhook/criacaocandidaturas`. Detalhe em `docs/fora-do-github.md`.
