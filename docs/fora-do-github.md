# O que é feito fora do GitHub

Este arquivo lista o que o app usa e **não vive neste repositório**.

## EasyPanel (deploy e env)
- O GitHub Actions (`.github/workflows/deploy.yml`) constrói a imagem no push para `main` e publica em `ghcr.io/luanvillasboas14/candidaturas`.
- O EasyPanel usa source **Docker Image** `ghcr.io/luanvillasboas14/candidaturas:latest` (sem Nixpacks).
- Porta **3000**. Start command vazio (entrypoint da imagem). `docker-entrypoint.sh` força `HOSTNAME=0.0.0.0`.
- Variáveis de ambiente do app ficam só no EasyPanel. No GitHub, o secret é só `EASYPANEL_DEPLOY_WEBHOOK`.
- Ativação Cruzeiro lê o Postgres `dcz_sync` com `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` e `DB_NAME`. Essas chaves vão no EasyPanel, nunca no GitHub.
- Sync de localização: `POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/ativacao-cruzeiro/geo-sync`. A tela também dispara se o snapshot de matriculados for novo. Um cron diário depois das 12h (Brasília) cobre o upload do dia.
- App em produção: `https://dnaworkia-candidaturas.vkfaze.easypanel.host`

## Supabase DNA
- Projeto `moemgftlmncdqfvzscmq`. As migrations em `sql/` são executadas no SQL Editor, não no deploy.
- Tabelas usadas: `jobs`, `jobs_enriched`, `candidaturas`, `tracker_leads`, `alunos_cep`.
- `alunos_cep.vaga_enviada` (`text[]`): IDs das vagas já enviadas na Ativação Cruzeiro. Rodar `sql/migration_alunos_cep_vaga_enviada.sql` no SQL Editor.
- Webhook do Supabase (se ainda estiver ativo) dispara o n8n para preencher `deal_candidatura_id` depois da candidatura.

## n8n
- `https://dnaworkia-n8n.vkfaze.easypanel.host/webhook/criacaocandidaturas` — o app chama após INSERT de candidatura (POST com candidatura + `contact_name` + `total_candidaturas` + `outras_candidaturas`).
- Automação de lead pode chamar o webhook de origem do app com `{ "telefone": "..." }`.

### Scraping Pandapé (`/infojobs`)
O fluxo principal (workflow `4tYpT10DgQR8dYdr`) só dispara WhatsApp. Quem responde entra no CRM como WhatsApp, sem campanha. Depois do envio com sucesso no node **dedup+WhatsApp**, gravar a origem:

```javascript
await helpers.httpRequest({
  method: 'POST',
  url: 'https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/lead-criado',
  headers: { 'Content-Type': 'application/json' },
  body: {
    telefone: registro.telefone,
    origem: 'infojobs',
    campanha: registro.vacancyTitle || (registro.idvacancy ? 'Infojobs ' + registro.idvacancy : 'Infojobs'),
  },
  json: true,
  ignoreHttpStatusErrors: true,
});
```

No fluxo que já cria negócio + tag Infojobs + nota `Candidato via Infojobs — vaga: …`, o app também detecta a tag `cmrkrdkyh1gytpn01ae77p55q` no `deal_created`. Mesmo assim vale o POST acima depois da tag, com `contactId` e `dealId` se existirem.

No lote da checagem de 2h, incluir `vacancyTitle` (hoje vai só `idvacancy`) para o node **Taguear Infojobs** poder mandar o mesmo POST como rede de segurança.

## CRM DNA
- API: `https://integrations.bwipo.com` com Bearer `CRM_DNA_API_TOKEN`. Não usar `bwipo.com`, `api.bwipo.com` nem `frontend-front.v74knz.easypanel.host`.
- Evento `deal_created` (automação/webhook) deve apontar para `https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/lead-criado`.
- Campo `source` do contato vira `origem` (ex.: Instagram, Facebook, Dina Bwipo, infojobs).
- Campo de negócio `campanha` (slug `campanha`) recebe o rótulo lido da arte ou o nome da vaga do Pandapé.
- Tag de negócio **Infojobs** (`cmrkrdkyh1gytpn01ae77p55q`) e nota `Candidato via Infojobs` marcam origem `infojobs`.

## DNA Work (horários)
- `https://sistema.dnawork.ai/webhook/empresa.php` — horários das vagas, cruzados pelo `codigo` da tabela `jobs`.
