# Origem

Rota da tela: `/origem`.

## O que faz
Dashboard da origem dos leads na tabela `tracker_leads`: total, pizza por canal e campanhas. Filtro por período (7 dias ao abrir, no máximo 3 meses) e datas `dd/mm/aaaa` no horário de Brasília, digitadas ou escolhidas no calendário. O percentual aparece no tooltip ao passar o mouse na fatia.

A gravação na tabela não acontece na candidatura. O CRM (ou o n8n, se apontar para cá) chama o webhook exclusivo na criação do lead.

`campanha` no dashboard não usa o ID da Meta nem o shortcode do Instagram. O webhook baixa a foto do `referrer` (Facebook `og:image` / Instagram `/media/`), lê o texto com Tesseract local (`tessdata/`) e grava um rótulo do tipo `Operador de Loja, Zona Norte`. O mesmo texto vai para o campo `campanha` do negócio no CRM DNA. Enquanto isso, a API do dashboard usa o `headline` se `campanha` ainda for um ID.

## Arquivos desta página
- `src/app/origem/page.tsx` — tela.
- `src/origem/OrigemDashboard.tsx` — filtro, pizza e campanhas.
- `src/origem/date-range.ts` — período padrão de 7 dias e teto de 3 meses.
- `src/origem/crm-tracking.ts` — origem, campanha, headline e clids no CRM DNA.
- `src/origem/campaign-label.ts` — decide o nome visível da campanha (ignora ID/shortcode).
- `src/origem/campaign-from-image.ts` — baixa a foto do referrer, OCR e rótulo da campanha.
- `src/origem/crm-deal-campaign.ts` — grava o rótulo no campo `campanha` do negócio no CRM.
- `src/app/api/tracker-leads/route.ts` — `GET` do dashboard.
- `src/app/api/webhooks/lead-criado/route.ts` — `POST` exclusivo do CRM (`deal_created` / `contact_created`).
- `src/lib/supabase-server.ts` — `upsertTrackerLead` e `listTrackerLeads`.
- `sql/migration_tracker_leads.sql` — tabela (telefone, origem, campanha, headline, ctwa_clid, fbclid, gclid, referrer, created_at). A tabela em produção pode não ter `updated_at`.

## Contrato do webhook
`POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/lead-criado`

Body aceito: `{ "telefone": "+5511..." }` e/ou `{ "contactId": "..." }`. O CRM pode mandar o payload padrão com `event` + `contactId`.
