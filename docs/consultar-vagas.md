# Consultar vagas

Rota da tela: `/consultar-vagas`.

## O que faz
A pessoa filtra por cargo, empresa e status. A lista de abertas esconde a vaga cujo status no Lightsail não é mais 0. Uma vaga aberta pode ser marcada como contratada ou cancelada. Demitida só aparece numa consulta que já está contratada. Uma consulta cancelada pode ser aberta de novo: a vaga volta para a lista e a consulta sai. O desfecho fica em `consulta_vaga`. A vaga some da tabela `vaga` do Supabase e continua no MySQL, com outro status.

Filtros: cargo pelo texto, empresa pelo nome fantasia (também as que só restam na consulta) e status (contratada, demitida ou cancelada). O status não esconde as vagas ainda abertas.

Ao marcar contratada ou cancelada, nesta ordem: confere a vaga no Supabase e o nome fantasia da empresa; atualiza `dna_work.vaga` (`status` 1 contratada ou 6 cancelada, e `data_status` no dia de São Paulo); grava `consulta_vaga` se esse id ainda não existir, com uma cópia da vaga na coluna `vaga`; apaga só essa linha de `vaga` no Supabase. Se o MySQL não achar a vaga ou falhar, nada é gravado na consulta e a vaga continua no Supabase. Se a consulta acabou de ser criada e o delete no Supabase falhar, essa consulta é apagada. Demitir só atualiza a consulta que está contratada e o MySQL (`status` 2). Abrir de novo uma cancelada volta o MySQL para `status` 0, recria a linha em `vaga` e apaga essa consulta. Não apaga `vaga_repetida`, `etapa_vaga`, `vaga_valores`, `vaga_endereco` ou `codigo_vaga`. Não apaga a linha no MySQL e não cria coluna lá.

`consulta_vaga.vaga_id` é o `id` da linha em `vaga`, o mesmo UUID de `dna_work.vaga.id_vaga`.

A tabela nasce no SQL Editor. O deploy não cria tabela. RLS ligado, sem policy para a anon key. A gravação usa a service role.

```sql
create table if not exists public.consulta_vaga (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null unique,
  empresa_id uuid not null,
  empresa_nome text not null,
  cargo text not null,
  tipo_vaga integer not null,
  status text not null check (status in ('contratada', 'demitida', 'cancelada')),
  criado_em timestamptz not null default now()
);

alter table public.consulta_vaga enable row level security;

alter table public.consulta_vaga add column if not exists vaga jsonb;
```

## Arquivos desta página
- `src/app/consultar-vagas/page.tsx` — tela.
- `src/consultar-vagas/ConsultarVagas.tsx` — filtros e listas.
- `src/consultar-vagas/tipos.ts` — status e tipos da tela.
- `src/consultar-vagas/consulta.ts` — leitura e desfecho nos dois bancos.
- `src/app/api/consultar-vagas/route.ts` — `GET` e `POST`.
