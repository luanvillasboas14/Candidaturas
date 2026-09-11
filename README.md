# Candidaturas

Sistema interno para registrar candidaturas de candidatos a vagas do DNA Work.

## O que faz
- O atendente informa o telefone do candidato e seleciona a vaga.
- O sistema tenta salvar a candidatura no Supabase.
- Se o candidato já tiver uma candidatura para aquela vaga, o banco bloqueia e a página avisa.
- Depois, o Supabase dispara um webhook para o n8n criar um negócio no pipeline "Candidaturas" do CRM e preencher o ID do negócio na candidatura.

## Stack
- Next.js 15 + React 19 + TypeScript
- Supabase (banco + webhooks)
- n8n (automação futura)

## Como rodar
1. Copiar `.env.example` para `.env.local` e preencher as chaves do Supabase.
2. Executar a migration em `sql/migration_candidaturas.sql` no SQL Editor do Supabase DNA.
3. `npm install`
4. `npm run dev`

## Pontos importantes
- A proteção contra candidatura duplicada está no banco: `UNIQUE(telefone_normalizado, vaga_endereco)`. Assim, vagas iguais com IDs diferentes não geram duplicidade.
- O telefone é sempre normalizado para E.164 (`5511999999999`) antes de salvar.
- `deal_candidatura_id` é gerado como UUID único no INSERT e será substituído pelo ID do negócio quando o n8n processar.
- A coluna `status` foi removida da tabela.
- A coluna `vaga_endereco` guarda a descrição da vaga e endereço no momento da candidatura.
- Ao criar uma candidatura, a página avisa se o mesmo telefone já possui outras candidaturas em vagas diferentes.
- O `contact_id` é preenchido automaticamente buscando o telefone no CRM DNA; se não existir, fica `null`.
- Após salvar no banco, o sistema chama o webhook n8n para iniciar a automação de criação do negócio, enviando também o nome do contato (`contact_name`).
- A service role key do Supabase fica somente no backend (API route); o frontend usa anon key.
- A página possui modo claro/escuro (botão no topo direito) e não tem login por enquanto.
- A aba lateral navega entre Candidaturas e Vagas próximas.
- Em Vagas próximas, o atendente informa o CEP e o raio; o sistema localiza o CEP e usa latitude/longitude da tabela `jobs_enriched` para listar as vagas dentro do raio, da mais próxima para a mais distante.

## Arquivos principais
- `src/app/page.tsx` — tela de criação
- `src/app/api/candidaturas/route.ts` — API de criação
- `src/components/CandidaturaForm.tsx` — formulário
- `src/lib/phone.ts` — normalização de telefone
- `src/lib/supabase-server.ts` — acesso ao banco pelo backend
- `sql/migration_candidaturas.sql` — criação da tabela
