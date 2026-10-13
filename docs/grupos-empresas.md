# Grupos e empresas

Rota da tela: `/grupos-empresas`.

## O que faz
A pessoa escolhe **Grupo**, **Empresa** ou **Vaga**. Trocar de aba guarda o que já foi digitado em cada formulário. Grupo existe só no Supabase. Empresa nova entra no Supabase e no MySQL `dna_work` com o mesmo UUID. Não há endereço de vaga nesta tela. As 88 empresas ativas da planilha foram ligadas no Supabase ao UUID que já existia em `dna_work.empresa`, em 40 grupos. O sistema antigo não foi alterado. Vaga que já existe só no sistema antigo continua fora desta tela. O grupo da empresa é escolhido numa busca pelo nome do grupo ou pelo nome fantasia e razão social das empresas dele. As listas também filtram: grupo pelo próprio nome ou pelo nome de uma empresa associada; empresa pela razão social, nome fantasia ou grupo.

Grupo: nome obrigatório; e-mail ou telefone (os dois podem ser preenchidos). Empresa: CNPJ com 14 dígitos, razão social, nome fantasia, CEP, endereço e o mesmo contato. Número e complemento são opcionais. O CEP consulta o ViaCEP e preenche o endereço, que continua editável. O grupo é obrigatório. Telefone vai para E.164 (`55DDNNNNNNNN`). CNPJ e CEP são gravados só com dígitos. Espaços no e-mail são removidos.

Antes de gravar empresa, o CNPJ é recusado se já existir em `dna_work.empresa` ou em `empresa` no Supabase, mesmo que a empresa antiga não esteja no sistema novo. A comparação no MySQL ignora ponto, barra, traço e espaço.

Empresa nova: gera o UUID, grava `dna_work.empresa` (`tipo_empresa=1`, `matriz` = o mesmo UUID, `status=1`, `sede=10`, `mesmoendereco=1`, `nome_confidencial=1`, `usa_agente=1`; contato ausente como string vazia), duas linhas em `assinaturas_empresa` (`TCE` e `Convenio`, `responsavel=1`) e o mesmo `id` no Supabase. O CEP da empresa nova vai para a API de geocodificação do Google e a latitude e a longitude entram só na tabela `empresa` do Supabase. Se essas colunas não existirem, rode `alter table public.empresa add column if not exists latitude double precision; alter table public.empresa add column if not exists longitude double precision;`. A edição da empresa não consulta o mapa de novo. Se o Supabase falhar, apaga só as assinaturas e a empresa desse UUID no MySQL. A chave fica em `GOOGLE_MAPS_API_KEY`.

Edição de grupo atualiza só o Supabase. Edição de empresa atualiza o grupo, CNPJ, razão social, nome fantasia, CEP, endereço, número, complemento, e-mail e telefone. No Lightsail mudam CNPJ, razão social, nome fantasia, e-mail, telefone, CEP, logradouro, número e complemento. Bairro, cidade e UF do sistema antigo não são preenchidos por esta tela. Trocar de grupo não altera o Lightsail. `grupo_id` no Supabase é obrigatório. As colunas de endereço do Supabase nascem no SQL Editor. CNPJ novo é conferido de novo nos dois bancos, ignorando o próprio id. `sede`, `matriz`, `tipo_empresa`, `status` e `assinaturas_empresa` não mudam na edição.

Vaga: a empresa já cadastrada nesta tela e o tipo vêm antes dos campos. Estágio pede quantidade, cargo, salário, carga horária (20 ou 30), benefícios e conduções (opcionais), jornada (fixa ou escala) e tipo de trabalho (presencial, remoto ou híbrido). Carga horária, turno (Manha, Tarde ou Noite), do dia, até o dia, entrada e intervalo ficam no fim do formulário. A saída é calculada e os dias da faixa recebem a mesma entrada e saída; cada dia pode ser ajustado sem passar da carga, formação (sem formação, 31 Ensino Médio, 32 Ensino Técnico, 33 Ensino Superior, 36 Ensino Supletivo), sexo (I, M ou F), idade de, idade até e um texto de atividades. Distância máxima e tempo até o local são opcionais. Se a tabela já foi criada com a regra que obriga tempo no estágio, rode `alter table public.vaga drop constraint if exists vaga_tempo_estagio;`. CLT pede os mesmos campos do estágio, com carga 44 ou 40. Salário vazio no CLT grava 0.00. Tempo até o local é opcional nos dois. Pessoa jurídica fica fora do tipo por enquanto. Não pede transporte nem CEP na tela. O CEP, a latitude e a longitude da vaga no Supabase são os da empresa. Não usa o prazo de 730 dias da modalidade. Quantidade 3 abre 3 vagas, cada uma com UUID próprio, o mesmo código (`ABC-1234`) e o mesmo comparador. A lista mostra empresa, tipo, cargo e código. Cada item pode ser editado, como grupo e empresa, ou excluído. Se a vaga editada deixar de ser igual às outras que compartilhavam o mesmo identificador, ela recebe outro identificador e outro código. A exclusão tira a vaga do Supabase e do MySQL, junto com etapa e log. Valores e endereço saem quando não há outra vaga com o mesmo comparador. Se ainda há, a linha de `vaga_valores` é retirada só para o MySQL aceitar a exclusão e gravada de novo para as que ficam. A cópia em `vaga_repetida` permanece.

Com a empresa escolhida, a vaga nova oferece as vagas já abertas por ela. Escolher uma preenche o formulário, inclusive o horário, e a quantidade continua a que foi digitada. Essa lista fica em `vaga_repetida`, uma linha por vaga diferente (`vaga_id`). Abrir ou editar grava ou atualiza essa linha. A vaga igual é procurada também nessa lista, então uma vaga que já saiu de `vaga` não gera outra cópia. Apagar a vaga não apaga a cópia. Rode no SQL Editor:

```sql
create table if not exists public.vaga_repetida (
  id uuid primary key,
  vaga_id uuid not null unique,
  grupo_id uuid,
  empresa_id uuid,
  tipo_vaga text,
  cargo text,
  salario numeric,
  carga_horaria text,
  escolaridade text,
  sexo text,
  idade integer,
  idade_ate integer,
  km numeric,
  atividades text,
  tempo text,
  horario text,
  turno text,
  beneficios text,
  conducoes text,
  jornada text,
  tipo_trabalho text,
  cep text,
  latitude double precision,
  longitude double precision
);

alter table public.vaga_repetida enable row level security;

insert into public.vaga_repetida (
  id, vaga_id, grupo_id, empresa_id, tipo_vaga, cargo, salario, carga_horaria,
  escolaridade, sexo, idade, idade_ate, km, atividades, tempo, horario, turno,
  beneficios, conducoes, jornada, tipo_trabalho, cep, latitude, longitude
)
select distinct on (vaga_id)
  gen_random_uuid(), vaga_id, grupo_id, empresa_id, tipo_vaga, cargo, salario, carga_horaria,
  escolaridade, sexo, idade, idade_ate, km, atividades, tempo, horario, turno,
  beneficios, conducoes, jornada, tipo_trabalho, cep, latitude, longitude
from public.vaga
where vaga_id is not null
order by vaga_id, cargo
on conflict (vaga_id) do nothing;
```

A gravação no MySQL usa só tabelas que já existem: `codigo_vaga`, `vaga`, `etapa_vaga`, `log_diversos` (ação `Abertura de vaga ADM`), `vaga_valores` e `vaga_endereco`. `sede` sai de `empresa.sede`. Atividades vão iguais em `atribuicaoes` e `atribu_contrato`. No CLT, `jornada` grava 0 (fixa) ou 1 (escala) e `remoto` grava 0 (presencial), 1 (remoto) ou 2 (híbrido). Estágio e pessoa jurídica deixam essas duas colunas nulas. O CEP de `vaga_endereco` é o CEP da empresa; o restante do endereço fica vazio. Em pessoa jurídica, `km` fica nulo (a coluna tem default 30). Tempo fica só na tabela `vaga` do Supabase, no estágio e no CLT, junto com `grupo_id` da empresa. No Supabase, estágio e CLT gravam `jornada` (`fixa` ou `escala`) e `tipo_trabalho` (`presencial`, `remoto` ou `hibrido`). Pessoa jurídica grava sim ou não na mesma coluna `jornada`. Essa coluna é a antiga `folgas_fixas`, só com o nome trocado. Rode `alter table public.vaga rename column folgas_fixas to jornada; alter table public.vaga add column if not exists tipo_trabalho text;`. `vaga_id` é o mesmo em todas as linhas da mesma vaga: as várias unidades de uma abertura e uma abertura nova igual a uma que já existe. Código e comparador não vão para o Supabase. Cada linha do Supabase usa o mesmo UUID de `dna_work.vaga.id_vaga`. Se o Supabase falhar, a abertura inteira sai do MySQL: essas vagas, as etapas, os logs, os valores, o endereço e o código. Não cria coluna no Lightsail.

Na edição, o botão Excluir pede confirmação. Grupo some só do Supabase e é recusado se ainda tiver empresa. Empresa sai primeiro do MySQL (assinaturas e a linha daquele UUID, ou a linha com o mesmo CNPJ) e só depois do Supabase. Se o Lightsail não apagar a linha, a exclusão para e a empresa continua nos dois lugares.

As tabelas do Supabase são criadas no SQL Editor do projeto `moemgftlmncdqfvzscmq`. O deploy não cria tabela. RLS ligado, sem policy para a anon key. A gravação usa a service role.

## Arquivos desta página
- `src/app/grupos-empresas/page.tsx` — tela.
- `src/grupos-empresas/GruposEmpresas.tsx` — escolha, formulário e listas.
- `src/grupos-empresas/validar.ts` — CNPJ, contato e tipos.
- `src/grupos-empresas/gravar.ts` — leitura e gravação nos dois bancos.
- `src/grupos-empresas/vaga.ts` — abertura e exclusão de vaga nos dois bancos.
- `src/app/api/grupos-empresas/vagas/route.ts` — `GET`, `POST`, `PATCH` e `DELETE`. `GET ?repetidas=` lista as vagas já abertas da empresa.
- `src/app/api/grupos/route.ts` — `GET` e `POST`.
- `src/app/api/grupos/[id]/route.ts` — `PATCH` e `DELETE`.
- `src/app/api/empresas/route.ts` — `GET` e `POST`. A lista é só do Supabase, com o nome do grupo.
- `src/app/api/empresas/[id]/route.ts` — `PATCH` e `DELETE`.
