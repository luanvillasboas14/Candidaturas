# Regras e contexto para agentes — Candidaturas

## Propósito do projeto
Sistema interno para registrar candidaturas de candidatos a vagas do DNA Work. Uma candidatura é criada a partir do telefone do candidato e do identificador real da vaga (`job_id`). Posteriormente, um webhook do Supabase dispara o n8n para criar um negócio no pipeline "Candidaturas" do CRM próprio e preencher `deal_candidatura_id`.

## Regra geral de documentação
Sempre que implementar algo novo, adicionar neste AGENTS.md apenas o que for realmente utilizado e mantido. Se testamos algo, não funcionar e for apagado, não precisa adicionar aqui. Atualizar este arquivo quando:
- criar ou alterar uma rota/API;
- criar ou alterar uma tabela/migration;
- adicionar uma variável de ambiente obrigatória;
- mudar a regra de negócio principal (ex: chave de unicidade, fluxo de status).

## Stack e padrões
- Next.js 15 com App Router e TypeScript.
- Server Components para layout estático; listas de vagas vêm de API routes em runtime.
- Client Components apenas para interatividade de formulário (`'use client'`).
- API routes para operações que precisam de service role key (INSERT em `candidaturas`) e para buscar vagas em runtime.
- Supabase: anon key no frontend, service role key somente no backend via variável de ambiente.
- Telefone sempre normalizado para E.164 (`55DDNNNNNNNN`) antes de persistir e antes de validar duplicidade.
- Duplicidade é protegida pelo banco via `UNIQUE(telefone_normalizado, vaga_endereco)`; o frontend não consulta antes de tentar criar. Isso garante que vagas idênticas com IDs diferentes não gerem candidaturas duplicadas.
- `deal_candidatura_id` é preenchido com `crypto.randomUUID()` no momento do INSERT e possui constraint UNIQUE; será substituído pelo ID real do negócio quando o n8n processar.
- A coluna `status` foi removida da tabela `candidaturas`.
- A coluna `vaga_endereco` armazena a descrição legível da vaga no momento da candidatura (ex: "Desenvolvedor Front-end — São Paulo - SP").
- Quando uma candidatura é criada com sucesso, a API retorna `hasOtherCandidaturas` e `otherCandidaturasCount` para informar se o mesmo telefone já possui candidaturas em outras vagas.
- Antes do INSERT, o backend busca o `contact_id` no CRM DNA pelo telefone normalizado usando `GET /api/contacts?phone=...` com Bearer token `CRM_DNA_API_TOKEN`. Se não encontrar, o campo fica `null`.
- Após o INSERT bem-sucedido, o backend chama o webhook n8n `https://dnaworkia-n8n.vkfaze.easypanel.host/webhook/criacaocandidaturas` (POST) com os dados da candidatura + `contact_name` do CRM DNA + `total_candidaturas` (total do telefone, incluindo a atual) + `outras_candidaturas` (em outras vagas). Se o INSERT falhar, o webhook não é chamado.
- A aba lateral navega entre Vagas próximas (`/`) e Candidaturas (`/candidaturas`). A home abre em Vagas próximas.
- `GET /api/vagas` devolve a lista da tabela `jobs` para o formulário de candidatura.
- `POST /api/vagas-proximas` recebe `cep` e `raioKm`, geocodifica o CEP (BrasilAPI) e usa `latitude`/`longitude` da tabela `jobs_enriched` para filtrar pelo raio e devolver as vagas da mais próxima para a mais distante.

## Variáveis de ambiente obrigatórias
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy
- O GitHub Actions (`.github/workflows/deploy.yml`) constrói a imagem Docker no push para `main` e publica em `ghcr.io/luanvillasboas14/candidaturas`.
- O EasyPanel deve usar source **Docker Image** e puxar `ghcr.io/luanvillasboas14/candidaturas:latest` (sem Nixpacks).
- Porta **3000**. O comando de start no EasyPanel deve ficar vazio (usa o entrypoint da imagem). Não deixar `npm start` da época do Nixpacks.
- O `docker-entrypoint.sh` força `HOSTNAME=0.0.0.0` e sobe `node /app/server.js`. Sem isso o Next standalone tenta escutar o hostname do container e o processo cai.
- No GitHub, o único secret necessário é `EASYPANEL_DEPLOY_WEBHOOK`. As variáveis de ambiente do app ficam só no EasyPanel.

## Estrutura de pastas
- `src/app/api/candidaturas/route.ts` — API de criação de candidatura.
- `src/app/api/vagas/route.ts` — API da lista de vagas do formulário de candidatura.
- `src/app/api/vagas-proximas/route.ts` — API de busca de vagas por CEP e raio.
- `src/app/page.tsx` — página inicial de vagas próximas.
- `src/app/candidaturas/page.tsx` — página de criação de candidatura.
- `src/components/AppShell.tsx` — aba lateral com navegação.
- `src/components/CandidaturaForm.tsx` — formulário interativo.
- `src/components/VagasProximasForm.tsx` — formulário de CEP e raio.
- `src/lib/geo.ts` — geocodificação de CEP/endereço e cálculo de distância.
- `src/lib/env.ts` — leitura de variáveis de ambiente em runtime.
- `src/lib/phone.ts` — normalização de telefone.
- `src/lib/supabase.ts` — cliente Supabase anon + busca de vagas.
- `src/lib/supabase-server.ts` — cliente Supabase service role + INSERT de candidatura.
- `src/types/candidatura.ts` — tipos compartilhados.
- `sql/migration_candidaturas.sql` — migration da tabela.

## Decisões arquiteturais
- A tabela `candidaturas` fica no mesmo Supabase DNA que a tabela `jobs`.
- A chave de unicidade é `(telefone_normalizado, job_id)` porque o fluxo atual começa apenas com o telefone do candidato; `contact_id` será usado quando disponível, mas não é obrigatório para a criação.
- `deal_candidatura_id` é nullable e será atualizado pelo n8n após a criação do negócio no pipeline.
- A página de criação não possui autenticação por enquanto; é proteção será adicionada se o escopo exigir.
