# O que é feito fora do GitHub

Este arquivo lista o que o app usa e **não vive neste repositório**.

## EasyPanel (deploy e env)
- O GitHub Actions (`.github/workflows/deploy.yml`) constrói a imagem no push para `main` e publica em `ghcr.io/luanvillasboas14/candidaturas`.
- O EasyPanel usa source **Docker Image** `ghcr.io/luanvillasboas14/candidaturas:latest` (sem Nixpacks).
- Porta **3000**. Start command vazio (entrypoint da imagem). `docker-entrypoint.sh` força `HOSTNAME=0.0.0.0`.
- Variáveis de ambiente do app ficam só no EasyPanel. No GitHub, o secret é só `EASYPANEL_DEPLOY_WEBHOOK`.
- App em produção: `https://dnaworkia-candidaturas.vkfaze.easypanel.host`

## Supabase DNA
- Projeto `moemgftlmncdqfvzscmq`. As migrations em `sql/` são executadas no SQL Editor, não no deploy.
- Tabelas usadas: `jobs`, `jobs_enriched`, `candidaturas`, `tracker_leads`.
- Webhook do Supabase (se ainda estiver ativo) dispara o n8n para preencher `deal_candidatura_id` depois da candidatura.

## n8n
- `https://dnaworkia-n8n.vkfaze.easypanel.host/webhook/criacaocandidaturas` — o app chama após INSERT de candidatura (POST com candidatura + `contact_name` + `total_candidaturas` + `outras_candidaturas`).
- Automação de lead pode chamar o webhook de origem do app com `{ "telefone": "..." }`.

## CRM DNA
- API: `https://integrations.bwipo.com` com Bearer `CRM_DNA_API_TOKEN`. Não usar `bwipo.com`, `api.bwipo.com` nem `frontend-front.v74knz.easypanel.host`.
- Evento `deal_created` (automação/webhook) deve apontar para `https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/lead-criado`.
- Campo `source` do contato vira `origem` (ex.: Instagram, Facebook, Dina Bwipo).
- Campo de negócio `campanha` (slug `campanha`) recebe o rótulo lido da arte.

## DNA Work (horários)
- `https://sistema.dnawork.ai/webhook/empresa.php` — horários das vagas, cruzados pelo `codigo` da tabela `jobs`.
