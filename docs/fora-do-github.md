# O que é feito fora do GitHub

Este arquivo lista o que o app usa e **não vive neste repositório**.

## EasyPanel (deploy e env)
- O GitHub Actions (`.github/workflows/deploy.yml`) constrói a imagem no push para `main` e publica em `ghcr.io/luanvillasboas14/candidaturas`.
- O EasyPanel usa source **Docker Image** `ghcr.io/luanvillasboas14/candidaturas:latest` (sem Nixpacks).
- Porta **3000**. Start command vazio (entrypoint da imagem). `docker-entrypoint.sh` força `HOSTNAME=0.0.0.0`.
- Variáveis de ambiente do app ficam só no EasyPanel. No GitHub, o secret é só `EASYPANEL_DEPLOY_WEBHOOK`.
- Ativação Cruzeiro lê o Postgres `dcz_sync` com `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` e `DB_NAME`. Essas chaves vão no EasyPanel, nunca no GitHub.
- Banco de Candidatos lê o MySQL `dna_work` (Lightsail/RDS) com `DNA_WORK_DB_*`. Master só no EasyPanel / `.env.local`. A lista é SELECT. A escrita acontece no fluxo Demitir, em `assinatura_digital` / `assinatura_digital_assinantes`, no cadastro de empresa (`empresa` e `assinaturas_empresa`) e na abertura de vaga (`codigo_vaga`, `vaga`, `etapa_vaga`, `log_diversos`, `vaga_valores`, `vaga_endereco`). A abertura não cria coluna. A exclusão nesta tela apaga a mesma vaga nessas tabelas, os valores e o endereço antes da vaga.
- ZapSign: `ZAPSIGN_API_TOKEN` e `ZAPSIGN_USER_TOKEN` no EasyPanel / `.env.local` (nunca no GitHub). Webhook do app: `POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/zapsign`. No painel ZapSign, o webhook antigo `sistema.dnawork.ai` pode continuar; o PHP em `99estagios.com` está morto.
- Sync de localização: `POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/ativacao-cruzeiro/geo-sync`. A tela também dispara se o snapshot de matriculados for novo. Um cron diário depois das 12h (Brasília) cobre o upload do dia.
- App em produção: `https://dnaworkia-candidaturas.vkfaze.easypanel.host`
- Ativação Infojobs só redireciona para o painel Pandapé → Bwipo CRM: `https://dnaworkia-disparador-infojobs.vkfaze.easypanel.host/`. Esse painel é outro app no EasyPanel; usuário e senha ficam nele.

## Supabase DNA
- Projeto `moemgftlmncdqfvzscmq`. As migrations em `sql/` são executadas no SQL Editor, não no deploy.
- Tabelas usadas: `jobs`, `jobs_enriched`, `tracker_leads`, `alunos_cep`, `grupo`, `empresa`, `vaga`, `vaga_repetida`, `consulta_vaga`.
- `grupo` e `empresa` nascem no SQL Editor (não há arquivo em `sql/` e o deploy não cria tabela). Grupo fica só no Supabase. Empresa nova usa o mesmo UUID em `dna_work.empresa` (`id_empresa` e `matriz`), com `tipo_empresa=1`, `status=1`, `sede=10`, `mesmoendereco=1`, `nome_confidencial=1`, `usa_agente=1`, e duas linhas em `assinaturas_empresa` (`TCE` e `Convenio`, `responsavel=1`). Se o insert no Supabase falhar, o app apaga só essa empresa e essas assinaturas no MySQL. `empresa.grupo_id` é obrigatório. O endereço da empresa (`cep`, `logradouro`, `numero`, `complemento`) fica no Supabase e nas colunas já existentes de `dna_work.empresa`. Empresa nova também grava `latitude` e `longitude` no Supabase, a partir do CEP, pela API de geocodificação do Google. No Lightsail as colunas de mapa já existentes são `lat` e `lng`; o cadastro novo não as preenche. Se o CNPJ existe em uma única linha do Lightsail e ainda não está no Supabase, o cadastro reaproveita esse `id_empresa`, grava `status = 1` e atualiza só os campos preenchidos. CNPJ com os mesmos 14 dígitos não é regravado, para a máscara antiga continuar encontrável. CEP com os mesmos 8 dígitos também fica. Se o CEP mudar, grava `bairro`, `cidade`, `uf` (ViaCEP) e `lat`/`lng` (Google) nessa linha. Cria em `assinaturas_empresa` só o `TCE` ou o `Convenio` que faltar. Se o Supabase falhar, devolve os valores anteriores dessa linha e apaga só as assinaturas criadas agora; a empresa antiga permanece. Mais de uma linha com o mesmo CNPJ interrompe o cadastro. Edição de empresa que já está nos dois bancos atualiza CNPJ, razão social, nome fantasia, e-mail, telefone e esses campos de endereço nos dois bancos; a troca de grupo fica só no Supabase. Excluir empresa apaga primeiro no MySQL `assinaturas_empresa` e `empresa` desse `id_empresa` (ou a linha do mesmo CNPJ) e só então o Supabase. Se o MySQL não apagar, nada sai do Supabase. Excluir grupo apaga só o Supabase e é recusado se ainda houver empresa nesse grupo.
- `vaga` no Supabase também nasce no SQL Editor. Guarda `grupo_id` da empresa, `vaga_id` compartilhado pelas vagas iguais, o mesmo UUID de `dna_work.vaga.id_vaga`, o tempo até o local do estágio e do CLT, a carga escolhida, o turno, benefícios, conduções, `jornada` e `tipo_trabalho`, e os sete dias do horário. `jornada` é a coluna que era `folgas_fixas`. No estágio e no CLT ela guarda `fixa` ou `escala`; na pessoa jurídica guarda sim ou não. `tipo_trabalho` guarda `presencial`, `remoto` ou `hibrido`. Não há coluna de CEP no MySQL da vaga além de `vaga_endereco.cep`, que copia o CEP da empresa. No Supabase a vaga também guarda `cep`, `latitude` e `longitude` copiados da empresa no momento da abertura e da edição. No MySQL a abertura grava `periodo`, `semanas_inicio`, `semanas_fim`, `horabase`, `pausa_almoco`, `tempo_refeicao` e a entrada e a saída de cada dia. No CLT, `jornada` e `remoto` usam os códigos que já existem nessa tabela, e `vaga_endereco.cep` copia `empresa.cep`. Código e comparador ficam só no MySQL. Se o insert no Supabase falhar, a abertura some do MySQL.
- `vaga_repetida` no Supabase guarda uma linha por vaga diferente da empresa. Abrir ou editar vaga grava ou atualiza essa linha. Uma vaga igual continua na mesma linha mesmo depois que ela sai de `vaga`. Apagar a vaga não apaga a cópia. Na vaga nova, a empresa mostra essas vagas para preencher o formulário. O SQL está em `docs/grupos-empresas.md`.
- `consulta_vaga` no Supabase guarda o desfecho da vaga. Contratada e cancelada tiram a linha de `vaga` no Supabase. Demitida só vale se a consulta já está contratada. Abrir de novo uma cancelada recria a vaga no Supabase, volta `dna_work.vaga.status` para 0 e apaga essa consulta. No MySQL a linha não é apagada: status 1, 2 ou 6, com `data_status` de hoje. O SQL está em `docs/consultar-vagas.md`.
- `alunos_cep.vaga_enviada` (`text[]`): IDs das vagas já enviadas na Ativação Cruzeiro. Rodar `sql/migration_alunos_cep_vaga_enviada.sql` no SQL Editor.

## n8n
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
- A mesma automação `POST https://dnaworkia-candidaturas.vkfaze.easypanel.host/api/webhooks/ganho` vale para Ganho, Processo seletivo realizado e Atendimento IA - Inicial. O corpo manda o id do negócio e o id do contato. O app lê a fase atual: Ganho (`c4682cb0a16da46e88f3ad82b196e4e45`) grava `passagem = ganho`; Processo seletivo realizado (`cmq0lqtoo09zup601ofbwckk0`) grava `passagem = seletivo`; Atendimento IA - Inicial (`cmusnlu5416nrmg01rme7zzka`) grava `tipo_vaga` no lead e, se o telefone ainda não estiver em `tracker_leads`, cria essa linha. Candidatura enviada ao cliente não entra. Outra fase é ignorada. `ganho_em` é a data dessa chamada. `deal_id` novo é `{id}:{data}`, sem o tipo da passagem. A tela lê `passagem` e conta quem passou pela fase no período, mesmo que já tenha saído. Não há varredura de quem já passou; a conta começa nas chamadas novas. Origem e campanha vêm de `tracker_leads` pelo telefone. Se o telefone não estiver nessa tabela, o webhook usa o campo `campanha` do negócio e o rastreio do contato. CLT ou estágio vem de `tipo_de_vaga` no contato e fica em `tipo_vaga` (`clt` ou `estagio`) nas duas tabelas. O id do anúncio (`adSourceId` do contato) fica em `ad_id` nas duas tabelas; a coluna nasce em `sql/migration_tracker_ad_id.sql`. A coluna nasce em `sql/migration_tracker_tipo_passagem.sql` (SQL Editor), que também preenche `passagem` das linhas antigas. A saída das 8h não entra nessa conta. A tabela nasce em `sql/migration_tracker_ganhos.sql` (SQL Editor).
- Campo `source` do contato vira `origem` (ex.: Instagram, Facebook, Dina Bwipo, infojobs).
- Campo de negócio `campanha` (slug `campanha`) recebe o rótulo lido da arte ou o nome da vaga do Pandapé.
- Tag de negócio **Infojobs** (`cmrkrdkyh1gytpn01ae77p55q`) e nota `Candidato via Infojobs` marcam origem `infojobs`.
- Tag de negócio **Cruzeiro**: a Ativação Cruzeiro cria o lead no estágio Ativação (`cmstdsc2v04pjk101qb2s0a6q`) do Pipeline Principal. Quem já está nesse funil fora de Perdido, ou em outro pipeline, não é alterado. Em Perdido (`cf133884ea761486f9855d93ffa4862a9`) o mesmo negócio volta para Ativação (campos + tag), para o WhatsApp disparar.

## DNA Work (horários)
- `https://sistema.dnawork.ai/webhook/empresa.php` — horários das vagas, cruzados pelo `codigo` da tabela `jobs`. A resposta pode vir com aviso PHP antes do JSON; o app lê o JSON a partir do primeiro `[` ou `{`. O resultado fica em memória por 5 minutos. Se o webhook atrasar ou falhar, a busca de vagas próximas segue com o cache anterior ou sem horário.
