# Origem

Rota da tela: `/origem`.

## O que faz
Dashboard da origem dos leads na tabela `tracker_leads`: total, pizza por canal e campanhas. Filtro por data (`dd/mm/aaaa`, horário de Brasília). O percentual aparece no tooltip ao passar o mouse na fatia.

A gravação na tabela não acontece na candidatura. O CRM (ou o n8n, se apontar para cá) chama o webhook exclusivo na criação do lead.

`campanha` no dashboard não usa o ID da Meta nem o shortcode do Instagram. O webhook baixa a foto do `referrer` (Facebook `og:image` / Instagram `/media/`), lê o texto com Tesseract local (`tessdata/`) e grava um rótulo do tipo `Operador de Loja, Zona Norte`. Enquanto isso, a API do dashboard usa o `headline` se `campanha` ainda for um ID.

## Arquivos desta página
- `src/app/origem/page.tsx` — tela.
- `src/origem/OrigemDashboard.tsx` — filtro, pizza e campanhas.
- `src/origem/crm-tracking.ts` — origem, campanha, headline e clids no CRM DNA.
- `src/origem/campaign-label.ts` — decide o nome visível da campanha (ignora ID/shortcode).
- `src/origem/campaign-from-image.ts` — baixa a foto do referrer, OCR e rótulo da campanha.
- `src/app/api/tracker-leads/route.ts` — `GET` do dashboard.
- `src/app/api/webhooks/lead-criado/route.ts` — `POST` exclusivo do CRM (`deal_created` / `contact_created`).
- `src/lib/supabase-server.ts` — `upsertTrackerLead` e `listTrackerLeads`.
- `sql/migration_tracker_leads.sql` — tabela (telefone, origem, campanha, headline, ctwa_clid, fbclid, gclid, referrer, created_at). A tabela em produção pode não ter `updated_at`.

## Contrato do webhook
`POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/lead-criado`

Body aceito: `{ "telefone": "+5511..." }` e/ou `{ "contactId": "..." }`. O CRM pode mandar o payload padrão com `event` + `contactId`.
