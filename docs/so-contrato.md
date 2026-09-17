# Só contrato

Rota da tela: `/so-contrato`.

## O que faz
Upload da foto da lista de contrato, OCR de nome e telefone, conferência e criação no CRM DNA: contato + negócio no estágio Ok contratação (`cmplhpr8z0021qn012ni60tri`, pipeline `cmodk1kqc0002qp013eranfa2`), responsável Ketolyn quando encontrada, tag "Só contrato". `reuseOpenDeal` evita duplicar negócio aberto no mesmo funil.

`POST /api/so-contrato/analisar` recebe a `foto` (multipart), recorta a tabela mesmo com fundo/UI em volta e lê com Tesseract local (`tessdata/`, sem download na internet). `POST /api/so-contrato` recebe `{ candidatos: [{ nome, telefone }] }` e chama `POST /api/leads` no CRM.

## Arquivos desta página
- `src/app/so-contrato/page.tsx` — tela.
- `src/so-contrato/SoContratoForm.tsx` — upload, conferência e envio.
- `src/so-contrato/so-contrato-ocr.ts` — extração de nome e telefone.
- `src/so-contrato/so-contrato-image.ts` — recorte e contraste.
- `src/so-contrato/so-contrato-tesseract.ts` — worker Tesseract.
- `src/so-contrato/crm-so-contrato.ts` — criação do negócio no CRM.
- `src/app/api/so-contrato/analisar/route.ts` — OCR.
- `src/app/api/so-contrato/route.ts` — cadastro no CRM.
- `tessdata/` — `por.traineddata` e `eng.traineddata`.
