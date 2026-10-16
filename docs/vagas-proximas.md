# Vagas próximas

Rota da tela: `/` (`src/app/page.tsx`). `/vagas-proximas` redireciona para `/`.

## O que faz
O atendente informa o CEP e o tipo (`CLT` e/ou `Estágio`). Nos filtros ficam a distância (o raio que já existia), o sexo e a idade da pessoa. Sexo e idade são opcionais. Sem eles, a lista não muda. Com sexo, entra a vaga marcada com esse sexo ou com sexo indiferente. Com idade, entra a vaga cuja faixa cobre essa idade. A distância continua sendo o raio a partir do CEP. O sistema geocodifica o CEP e lista vagas da tabela `jobs_enriched` dentro do raio. Cada vaga mostra o horário de trabalho quando o `codigo` existe no webhook de horários. Vagas iguais (mesmo título, empresa, local, tipo e salário) entram uma vez só, ficando a mais próxima. Se a diferença for só o horário, a linha mostra cada horário. O texto para o candidato usa endereço, horário (quando existir) e salário (0 = salário a combinar; com benefícios = salário + benefícios), sem distância. Com uma vaga, termina com “Possui interesse?”. Com várias, “Possui interesse? Se sim, nos informe o número da vaga.” Se a vaga tem folga (no texto da carga ou por trabalhar 6–7 dias), isso entra no horário.

## Arquivos desta página
- `src/app/page.tsx` — tela.
- `src/app/vagas-proximas/page.tsx` — redirect para `/`.
- `src/vagas-proximas/VagasProximasForm.tsx` — CEP, raio, tipos e texto.
- `src/vagas-proximas/geo.ts` — geocodificação do CEP e distância.
- `src/vagas-proximas/dna-work-hours.ts` — horários.
- `src/app/api/vagas-proximas/route.ts` — `POST` com `cep`, `raioKm`, `tipos` e, quando preenchidos, `sexo` (`M` ou `F`) e `idade`. Sexo e idade vêm da vaga aberta no Lightsail, pelo `codigo`.
- `src/instrumentation.ts` — no Node, prefere IPv4 ao abrir conexão.
- `src/lib/supabase.ts` — leitura de `jobs` / `jobs_enriched`.

## Regras de geocode
Cidade e rua vêm do ViaCEP. A coordenada do CEP vem da AwesomeAPI junto com essa consulta; a BrasilAPI só entra se essa coordenada não servir. Essa consulta roda no navegador, e a tela manda a coordenada para o servidor. O servidor só tenta localizar o CEP se a coordenada não vier. Uma falha ou demora de um desses serviços não derruba a busca. No servidor publicado a consulta sai por IPv4, porque o IPv6 do container não completa e o CEP ficava sem coordenada. A coordenada do próprio CEP entra primeiro e não é descartada por estar longe do centro nem por cair em outro município. A lista de vagas não filtra cidade: mede a distância e, se ninguém estiver no raio, a tela mostra que não há vagas próximas. O mapa só entra se o CEP não trouxer coordenada, e só com um resultado cujo CEP coincide no começo. O centro genérico de São Paulo continua de fora quando a API não achou o logradouro. Não assume São Paulo quando a API não devolve cidade. Não geocodifica só a cidade em São Paulo. Se nenhuma dessas fontes achar coordenada, o servidor consulta o Google com `GOOGLE_MAPS_API_KEY`, a mesma chave do cadastro de empresa. A chave fica só no servidor e não entra quando ViaCEP, AwesomeAPI, BrasilAPI ou o mapa já devolveram o ponto.

## Fora desta pasta
Horário das vagas vem de `https://sistema.dnawork.ai/webhook/empresa.php`, cruzado pelo `codigo` da tabela `jobs`. Detalhe em `docs/fora-do-github.md`.
