# Origem

Rota da tela: `/origem`.

## O que faz
Dashboard da origem dos leads na tabela `tracker_leads`: total, pizza por canal e campanhas. Lê todas as rows do período (página de 1000 em 1000; o Supabase corta em 1000 se for um `select` só). Filtro por período (7 dias ao abrir, no máximo 3 meses) e datas `dd/mm/aaaa` no horário de Brasília, digitadas ou escolhidas no calendário. O percentual aparece no tooltip ao passar o mouse na fatia. A lista de campanhas omite “Sem campanha”; cada vaga do Infojobs e cada arte de Instagram/Facebook entra como uma campanha.

A gravação na tabela não acontece na candidatura. O CRM (ou o n8n, se apontar para cá) chama o webhook exclusivo na criação do lead.

Leads ativados pelo Scraping Pandapé (comando `/infojobs`) entram no CRM pelo WhatsApp, sem referrer de anúncio. O n8n deve chamar o mesmo webhook com `origem: infojobs` e `campanha` igual ao nome da vaga. Se o negócio já tiver a tag Infojobs ou a nota `Candidato via Infojobs — vaga: …`, o webhook também preenche sozinho. Origem de anúncio (Instagram/Facebook/Google/TikTok) não é sobrescrita; `infojobs` ganha de `whatsapp`, `Dina Bwipo` e vazio. Acentos que o Pandapé manda como `&#xE1;` são decodificados antes de gravar na tabela e no CRM.

`campanha` no dashboard não usa o ID da Meta nem o shortcode do Instagram. O webhook baixa a foto do `referrer` (Facebook `og:image` / Instagram `/media/`), lê o texto com Tesseract local (`tessdata/`) e grava um rótulo do tipo `Operador de Loja, Zona Norte`. O mesmo texto vai para o campo `campanha` do negócio no CRM DNA. Enquanto isso, a API do dashboard usa o `headline` se `campanha` ainda for um ID.

## Arquivos desta página
- `src/app/origem/page.tsx` — tela.
- `src/origem/OrigemDashboard.tsx` — filtro, pizza e campanhas.
- `src/origem/date-range.ts` — período padrão de 7 dias e teto de 3 meses.
- `src/origem/crm-tracking.ts` — origem, campanha, headline e clids no CRM DNA.
- `src/origem/campaign-label.ts` — decide o nome visível da campanha (ignora ID/shortcode) e decodifica acentos HTML do Pandapé.
- `src/origem/infojobs-vacancies.ts` — cruza `Infojobs {id}` com o nome da vaga lido no scraping.
- `src/origem/campaign-from-image.ts` — baixa a foto do referrer, OCR e rótulo da campanha.
- `src/origem/crm-deal-campaign.ts` — grava o rótulo no campo `campanha` do negócio no CRM.
- `src/origem/lead-origin.ts` — Infojobs/Pandapé, prioridade de canais e merge com o que já está no tracker.
- `src/origem/crm-deal-origin.ts` — lê tag Infojobs e nota da vaga no negócio.
- `src/app/api/tracker-leads/route.ts` — `GET` do dashboard.
- `src/app/api/webhooks/lead-criado/route.ts` — `POST` do CRM (`deal_created` / `contact_created`) e do n8n (Pandapé).
- `src/lib/supabase-server.ts` — `upsertTrackerLead` e `listTrackerLeads`.
- `sql/migration_tracker_leads.sql` — tabela (telefone, origem, campanha, headline, ctwa_clid, fbclid, gclid, referrer, created_at). A tabela em produção pode não ter `updated_at`.

## Contrato do webhook
`POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/lead-criado`

Body aceito:

- CRM: `{ "event": "deal_created", "contactId": "...", "dealId": "..." }` e/ou `{ "telefone": "+5511..." }`.
- n8n Pandapé: `{ "telefone": "+5511...", "origem": "infojobs", "campanha": "Nome da vaga" }`. Sem `event`. O contato ainda não precisa existir no CRM.
