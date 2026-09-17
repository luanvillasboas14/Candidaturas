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
A BrasilAPI às vezes devolve o centro de São Paulo. A origem do CEP usa a coordenada da AwesomeAPI quando ela não é o centro da cidade; senão Photon pela rua (sem o bairro, que o OSM muitas vezes não conhece) e casa o postcode. Não cai no geocode só da cidade em São Paulo.

## Fora desta pasta
Horário das vagas vem de `https://sistema.dnawork.ai/webhook/empresa.php`, cruzado pelo `codigo` da tabela `jobs`. Detalhe em `docs/fora-do-github.md`.
