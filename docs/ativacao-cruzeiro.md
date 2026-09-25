# Ativação Cruzeiro

Rota da tela: `/ativacao-cruzeiro`.

## O que faz
Lista alunos únicos do último snapshot `xl_snapshots.tipo = 'matriculados'` e `negocio = GRADUAÇÃO`. Isso é o recorte de quem está matriculado em graduação. A mesma pessoa não entra duas vezes (`rgm`, ou `cpf` se não houver RGM). Pós, curso livre e colégio ficam de fora.

O nome do curso vai sem o prefixo do tipo (`CST em`, `Bacharelado em`, `Licenciatura em`…): `CST em Cibersegurança` vira `Cibersegurança` no filtro, na lista e no que segue para o envio.

Filtros opcionais: faixa de idade (`data_nasc`), um ou mais cursos agrupados, um ou mais semestres (`serie`), sexo, e local por **bairro ou raio** (nunca os dois ao mesmo tempo). Sem nenhum filtro a lista fica vazia. Se o filtro estiver incompleto, ele é ignorado. Idade só vale com os dois lados preenchidos. No modo raio, o ponto de origem é lat/lng da vaga (`jobs_enriched`); CEP só entra se for digitado na mão. A distância é haversine contra lat/lng da `alunos_cep`. A lista mostra o bairro do aluno.

A vaga (`jobs.id`) é obrigatória e aparece como título + bairro; na busca o tipo é CLT ou Estágio. Ao escolhê-la, a tela preenche bairro e, no modo CEP, o raio usa lat/lng da `jobs_enriched` (o CEP do n8n pode vir vazio). Idade automática: Estágio 18–22, CLT 20–50. Trocar a vaga atualiza idade e local automáticos; o que foi digitado na mão fica. Depois do resultado, quantas pessoas, **Selecionar todos** e o clique em cada aluno (como no Vagas próximas) marcam quem vai no **Ativar**. Quem já tem essa vaga em `alunos_cep.vaga_enviada` não entra. `vaga_enviada` é um array: a mesma pessoa pode receber vagas diferentes, mas não a mesma de novo.

A localização dos alunos fica no Supabase, tabela `alunos_cep` (uma row por telefone). O ponto vem da **rua** do snapshot (`endereço` / `endereco`): ViaCEP acha o CEP do logradouro e o geocode usa esse CEP. Sem rua válida, cai no bairro. O sync **não** importa a base inteira. No primeiro snapshot ele só marca o ponto; no seguinte inclui quem entrou e apaga da `alunos_cep` quem saiu. Se vários endereços ainda compartilham o mesmo lat/lng, esse ponto não entra no raio. `POST /api/ativacao-cruzeiro/geo-sync` sincroniza e corrige um lote de ruas.

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
- `src/ativacao-cruzeiro/geo-local.ts` — geocode pela rua (ViaCEP → CEP → lat/lng); bairro só se não houver rua.
- `src/ativacao-cruzeiro/alunos-cep-sync.ts` — incrementa `alunos_cep` no snapshot novo.
- `src/ativacao-cruzeiro/alunos-cep-repair.ts` — regeocodifica alunos pela rua do snapshot.
- `src/ativacao-cruzeiro/alunos-cep-backfill.ts` — carga da base atual, 1 rua/s.
- `scripts/backfill-alunos-cep.ts` — roda o backfill local.
- `src/app/api/ativacao-cruzeiro/geo-sync/route.ts` — `GET` status e `POST` sync incremental.
- `sql/ativacao_geo.sql` — tabelas `ativacao_locais`, `ativacao_alunos_geo`, `ativacao_geo_sync`.
- `sql/migration_alunos_cep.sql` — tabela `alunos_cep` no Supabase (uma row por telefone).
- `sql/migration_alunos_cep_vaga_enviada.sql` — coluna `vaga_enviada text[]` em `alunos_cep`.

## Variáveis
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`. No EasyPanel; localmente em `.env.local`.
