# Ativação Cruzeiro

Rota da tela: `/ativacao-cruzeiro`.

## O que faz
Lista alunos únicos do último snapshot `xl_snapshots.tipo = 'matriculados'` e `negocio = GRADUAÇÃO`. Isso é o recorte de quem está matriculado em graduação. A mesma pessoa não entra duas vezes (`rgm`, ou `cpf` se não houver RGM). Pós, curso livre e colégio ficam de fora.

Filtros opcionais: faixa de idade (`data_nasc`), curso agrupado (ignora bacharelado/licenciatura/4.0/egresso), um ou mais semestres (`serie`), sexo, bairro, CEP + raio. Sem nenhum filtro a lista fica vazia. Se o filtro estiver incompleto, ele é ignorado. Idade só vale com os dois lados preenchidos. CEP só vale com o raio; o “perto” usa lat/lng da `alunos_cep` e o mesmo geocode das Vagas próximas. Bairro e CEP podem ir juntos (os dois têm que bater). A lista mostra o bairro do aluno.

A vaga (`jobs.id`) é obrigatória no filtro. CEP sem raio não filtra. Depois do resultado a lista aparece; quantas pessoas e **Selecionar todos** só marcam quem vai no **Ativar**. Quem já tem essa vaga em `alunos_cep.vaga_enviada` não entra. `vaga_enviada` é um array: a mesma pessoa pode receber vagas diferentes, mas não a mesma de novo.

A localização dos alunos fica no Supabase, tabela `alunos_cep` (uma row por telefone). O sync **não** importa a base inteira. No primeiro snapshot ele só marca o ponto; no seguinte inclui quem entrou (com CEP do bairro) e apaga da `alunos_cep` quem saiu. `POST /api/ativacao-cruzeiro/geo-sync` faz isso; a tela chama se o snapshot for mais novo.

## Arquivos desta página
- `src/app/ativacao-cruzeiro/page.tsx` — tela.
- `src/ativacao-cruzeiro/AtivacaoCruzeiroDashboard.tsx` — filtros e lista.
- `src/ativacao-cruzeiro/curso-busca.ts` — busca do curso por nome, sigla e abreviação (RH, ADM).
- `src/ativacao-cruzeiro/queries.ts` — último snapshot, dedupe e filtros.
- `src/ativacao-cruzeiro/types.ts` — tipos da lista.
- `src/lib/cruzeiro-db.ts` — pool do Postgres Cruzeiro.
- `src/app/api/ativacao-cruzeiro/route.ts` — `GET` da lista.
- `src/app/api/ativacao-cruzeiro/envio/route.ts` — `POST` que grava a vaga em `vaga_enviada`.
- `src/app/api/ativacao-cruzeiro/opcoes/route.ts` — `GET` de cursos e semestres.
- `src/ativacao-cruzeiro/geo-local.ts` — chave cidade+bairro e geocode Photon (lat/lng + CEP se vier).
- `src/ativacao-cruzeiro/alunos-cep-sync.ts` — incrementa `alunos_cep` no snapshot novo.
- `src/ativacao-cruzeiro/alunos-cep-backfill.ts` — carga da base atual, 1 bairro/s, geocode igual ao Vagas próximas.
- `scripts/backfill-alunos-cep.ts` — roda o backfill local.
- `src/app/api/ativacao-cruzeiro/geo-sync/route.ts` — `GET` status e `POST` sync incremental.
- `sql/ativacao_geo.sql` — tabelas `ativacao_locais`, `ativacao_alunos_geo`, `ativacao_geo_sync`.
- `sql/migration_alunos_cep.sql` — tabela `alunos_cep` no Supabase (uma row por telefone).
- `sql/migration_alunos_cep_vaga_enviada.sql` — coluna `vaga_enviada text[]` em `alunos_cep`.

## Variáveis
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`. No EasyPanel; localmente em `.env.local`.
