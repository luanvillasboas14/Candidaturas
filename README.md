# DNA Work

Sistema interno DNA Work.

## Stack
- Next.js 15 + React 19 + TypeScript
- Supabase
- MySQL `dna_work`

## Como rodar
1. Copiar `.env.example` para `.env.local` e preencher as chaves.
2. `npm install`
3. `npm run dev`

A home abre em Vagas próximas. A aba lateral leva às outras telas.

## Deploy (GitHub + EasyPanel)
O GitHub constrói a imagem e o EasyPanel só puxa.

1. No GitHub: Settings → Secrets and variables → Actions → Secrets, criar `EASYPANEL_DEPLOY_WEBHOOK` com a Deployment Trigger URL do EasyPanel.
2. No EasyPanel, o source do serviço é **Docker Image**:
   - Imagem: `ghcr.io/luanvillasboas14/candidaturas:latest`
   - Porta: `3000`
3. As variáveis de ambiente ficam no EasyPanel.
