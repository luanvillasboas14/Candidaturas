# Vagas próximas

Rota da tela: `/` (`src/app/page.tsx`). `/vagas-proximas` redireciona para `/`.

## O que faz
O atendente informa CEP, raio e tipo (`CLT` e/ou `Estágio`). O sistema geocodifica o CEP e lista vagas da tabela `jobs_enriched` dentro do raio. Vagas iguais (mesmo título, empresa, local e tipo) entram uma vez só, ficando a mais próxima. O texto para o candidato usa endereço, horário (quando existir) e salário (0 = salário a combinar; com benefícios = salário + benefícios), sem distância. Com uma vaga, termina com “Possui interesse?”. Com várias, “Possui interesse? Se sim, nos informe o número da vaga.” Se a vaga tem folga (no texto da carga ou por trabalhar 6–7 dias), isso entra no horário.

## Arquivos desta página
- `src/app/page.tsx` — tela.
- `src/app/vagas-proximas/page.tsx` — redirect para `/`.
- `src/vagas-proximas/VagasProximasForm.tsx` — CEP, raio, tipos e texto.
- `src/vagas-proximas/geo.ts` — geocodificação do CEP e distância.
- `src/vagas-proximas/dna-work-hours.ts` — horários.
- `src/app/api/vagas-proximas/route.ts` — `POST` com `cep`, `raioKm` e `tipos`.
- `src/lib/supabase.ts` — leitura de `jobs` / `jobs_enriched`.

## Regras de geocode
Cidade e rua vêm do ViaCEP (e da BrasilAPI se o ViaCEP falhar). A coordenada só vale se estiver a até 30 km dessa cidade — assim um CEP de São Vicente não cai em Barra Funda/Vila Madalena. Photon pela rua+cidade entra primeiro; AwesomeAPI e BrasilAPI só se o ponto bater com a cidade. Não assume São Paulo quando a API não devolve cidade. Não geocodifica só a cidade em São Paulo.

## Fora desta pasta
Horário das vagas vem de `https://sistema.dnawork.ai/webhook/empresa.php`, cruzado pelo `codigo` da tabela `jobs`. Detalhe em `docs/fora-do-github.md`.
