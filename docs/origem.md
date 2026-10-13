# Origem

Rota da tela: `/origem`.

## O que faz
Dashboard da origem de quem entrou no período: total, pizza por canal e campanhas. A conta são os negócios criados na fase Lead de entrada (`cmuwy4al20inhpq016r5o75gn`) do funil Candidaturas entre as datas. A lista do negócio não traz o anúncio, então o contato de cada um é lido de novo, com folga abaixo de 300 chamadas por minuto. Se o CRM pedir para esperar, a mesma leitura é tentada de novo. Quem veio de anúncio da Meta (`ad`, `fb.me`, Instagram ou `utm_source` ig/fb) entra como `meta`, mesmo que a origem do WhatsApp seja Dina Bwipo. Quem está sem campanha entra no total e na lista como “Sem campanha”. O `tracker_leads` só completa o telefone de quem já está nessa fase (por exemplo Infojobs). Filtro por período (7 dias ao abrir, no máximo 3 meses) e datas `dd/mm/aaaa` no horário de Brasília, digitadas ou escolhidas no calendário. O percentual aparece no tooltip ao passar o mouse na fatia. Cada vaga do Infojobs e cada arte de Instagram/Facebook entra como uma campanha.

A gravação na tabela não acontece nesta tela. O CRM (ou o n8n, se apontar para cá) chama o webhook exclusivo na criação do lead.

Leads ativados pelo Scraping Pandapé (comando `/infojobs`) entram no CRM pelo WhatsApp, sem referrer de anúncio. O n8n deve chamar o mesmo webhook com `origem: infojobs` e `campanha` igual ao nome da vaga. Se o negócio já tiver a tag Infojobs ou a nota `Candidato via Infojobs — vaga: …`, o webhook também preenche sozinho. Origem de anúncio (Instagram/Facebook/Google/TikTok) não é sobrescrita; `infojobs` ganha de `whatsapp`, `Dina Bwipo` e vazio. Acentos que o Pandapé manda como `&#xE1;` são decodificados antes de gravar na tabela e no CRM.

Ganho por campanha: `POST /api/webhooks/ganho` grava cada entrada no estágio Ganho em `tracker_ganhos`. O mesmo telefone pode ter várias linhas. Origem e campanha saem de `tracker_leads` quando o telefone já existe lá; senão, do campo `campanha` do negócio e do rastreio do contato. A tela mostra, no mesmo período, a coluna Campanhas dos ganhos com o total e a quantidade por campanha e canal. Ganho sem campanha entra como “Sem campanha”.

`campanha` no dashboard não usa o ID da Meta nem o shortcode do Instagram. O webhook baixa a foto do `referrer` (Facebook `og:image` / Instagram `/media/`), lê o texto com Tesseract local (`tessdata/`) e grava um rótulo do tipo `Operador de Loja, Zona Norte`. O mesmo texto vai para o campo `campanha` do negócio no CRM DNA. Enquanto isso, a API do dashboard usa o `headline` se `campanha` ainda for um ID.

## Arquivos desta página
- `src/app/origem/page.tsx` — tela.
- `src/origem/OrigemDashboard.tsx` — filtro, pizza, campanhas dos leads e campanhas dos ganhos.
- `src/origem/date-range.ts` — período padrão de 7 dias e teto de 3 meses.
- `src/origem/crm-entradas.ts` — negócios criados em Lead de entrada no período, com teto de 300 chamadas por minuto.
- `src/origem/crm-tracking.ts` — origem, campanha, headline e clids no CRM DNA.
- `src/origem/campaign-label.ts` — decide o nome visível da campanha (ignora ID/shortcode) e decodifica acentos HTML do Pandapé.
- `src/origem/infojobs-vacancies.ts` — cruza `Infojobs {id}` com o nome da vaga lido no scraping.
- `src/origem/campaign-from-image.ts` — baixa a foto do referrer, OCR e rótulo da campanha.
- `src/origem/crm-deal-campaign.ts` — grava o rótulo no campo `campanha` do negócio no CRM.
- `src/origem/lead-origin.ts` — Infojobs/Pandapé, prioridade de canais e merge com o que já está no tracker.
- `src/origem/crm-deal-origin.ts` — lê tag Infojobs e nota da vaga no negócio.
- `src/app/api/tracker-leads/route.ts` — `GET` do dashboard (leads e ganhos do período).
- `src/app/api/webhooks/lead-criado/route.ts` — `POST` do CRM (`deal_created` / `contact_created`) e do n8n (Pandapé).
- `src/lib/supabase-server.ts` — `upsertTrackerLead`, `listTrackerLeads` e `listTrackerGanhos`.
- `sql/migration_tracker_leads.sql` — tabela (telefone, origem, campanha, headline, ctwa_clid, fbclid, gclid, referrer, created_at). A tabela em produção pode não ter `updated_at`.

## Contrato do webhook
`POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/lead-criado`

Body aceito:

- CRM: `{ "event": "deal_created", "contactId": "...", "dealId": "..." }` e/ou `{ "telefone": "+5511..." }`.
- n8n Pandapé: `{ "telefone": "+5511...", "origem": "infojobs", "campanha": "Nome da vaga" }`. Sem `event`. O contato ainda não precisa existir no CRM.
