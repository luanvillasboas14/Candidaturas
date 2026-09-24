# Banco de Candidatos

Rotas: `/banco-candidatos` (lista) e `/banco-candidatos/[id]` (detalhe + Demitir). A lista carrega sozinha. **Ver Detalhes** abre a página do candidato. Lista, opções e detalhe ficam em `sessionStorage` por 10 minutos; voltar à tela usa o cache. Os filtros aplicados (e a página) ficam na sessão até **Limpar filtros** ou fechar a aba. **Buscar** força atualização. Depois de demitir, o cache da lista é limpo.

Demitir só aparece se houver contratação ativa (`conratacaovaga.status = 1`) e a vaga for estágio (`tipo_vaga = 1`). Sem isso, o formulário não entra.

## O que faz
Consulta o banco de talentos do legado DNA Work (`dna_work` no MySQL Lightsail/RDS). Só lê na lista. Demitir (estágio) gera **um** documento, a Rescisão estágio ensino médio, e grava no legado na mesma transação para o sistema antigo não quebrar.

A lista pagina no MySQL: `COUNT(*)` com os mesmos filtros e depois `LIMIT 50 OFFSET`. Não puxa a base inteira. Nome só entra com 3+ letras; a busca ignora acento (`Araujo` acha `Araújo`) e aceita o texto no meio do nome. Salário e raio só entram se preenchidos.

Cada linha: encaminhado (sim/não, `emcaminhamento.reprovado IS NULL`), nome, idade, término, tipo de ensino (`flex`), instituição, curso, bairro, cidade, estado, cadastro. Distância em km só se a busca usou CEP+raio.

Status (`vw_candidato_status`: `disponivel`, `encaminhado`, `contratado`, `demitido`; default `todos`) continua igual: filtro pelos EXISTS da view, sem gravar status.

Demitir exige prévia da Rescisão estágio ensino médio antes de gravar. **Gerar prévia** abre `/banco-candidatos/previa` em página inteira (sem aba lateral) para leitura. A barra tem **Imprimir** (janela de impressão) e **Salvar em PDF** (download do arquivo). Sem marca DNAWORK e sem Ref. no documento. Depois de salvar, abre `/banco-candidatos/documento/[id]` do mesmo jeito. A ficha sempre mostra documentos (`contratos_gerados` + `texto_contrato`) e ocorrências. Não gera Termo de Compromisso de Estágio.

Demitir pede motivo em contrato (só as 2 frases), data, avaliação de desempenho, resumo das atividades (pré-preenche `vaga.atribu_contrato`, quebrando itens que o legado cola sem espaço) e motivo interno (não entra no documento). Bloqueia se já existir `demissao` para o mesmo `id_candidato` + `id_vaga`. Só gera documento quando `vaga.tipo_vaga = 1` (Estágio).

## Documento
Um único termo, o texto do PDF Recisão Modelo Novo (`templates/recisao-modelo-novo.html`), gravado com o nome **Rescisão estágio ensino médio**. Não usa os termos antigos nem a tabela `cabecalho`. Só preenche os buracos. Endereço da DNA Work é o do modelo (R. do Bosque, 1621, Loja 02, São Paulo/SP, CEP 01136-001, CNPJ 40.380.163/0001-61). `Ref.: TCE/[código]` vem do TCE já existente. Data do TCE nos considerandos = `conratacaovaga.datafim`. Cláusula 3 (ii) = `datainicio` até a data da demissão. Tipo de estágio marca `( X )` em Não Obrigatório. Avaliação é escolhida por botões. Resumo (cláusula 3-i) vem de `vaga.atribu_contrato`. O HTML vai para `texto_contrato`.

## Gravação da demissão (transação)
1. `INSERT contratos_gerados` (1 linha, nome `Rescisão estágio ensino médio`, `id_contrato` se o modelo existir em `contratos_diversos`) + `INSERT texto_contrato`. `contratos_demissao` grava o id único com vírgula final, como o legado.
2. `UPDATE conratacaovaga` status 2, `data_demicao` e `datafim`
3. `UPDATE contratos_gerados` status 0 nos contratos antigos daquele par
4. `UPDATE emcaminhamento` reprovado S / feed Demitido
5. `UPDATE vaga` status 2
6. `INSERT demissao` (`contratos_demissao` = id único novo)
7. `INSERT ocorrencias` e `ocorrencias_empresa`
8. `INSERT log_diversos` ação Demissão

Não altera `candidato`. Não apaga histórico.

## Arquivos
- `src/app/banco-candidatos/page.tsx`
- `src/app/banco-candidatos/[id]/page.tsx`
- `src/app/banco-candidatos/previa/page.tsx`
- `src/app/banco-candidatos/documento/[id]/page.tsx`
- `src/banco-candidatos/BancoCandidatosDashboard.tsx`
- `src/banco-candidatos/CandidatoDetalheDashboard.tsx`
- `src/banco-candidatos/queries.ts`
- `src/banco-candidatos/documento.ts`
- `src/banco-candidatos/demitir.ts`
- `src/lib/dna-work-db.ts`
- `src/app/api/banco-candidatos/route.ts`
- `src/app/api/banco-candidatos/opcoes/route.ts`
- `src/app/api/banco-candidatos/[id]/route.ts`
- `src/app/api/banco-candidatos/demitir/route.ts`
- `templates/recisao-modelo-novo.html`

## Variáveis
`DNA_WORK_DB_HOST`, `DNA_WORK_DB_PORT`, `DNA_WORK_DB_USER`, `DNA_WORK_DB_PASS`, `DNA_WORK_DB_NAME`. Opcional: `DNA_WORK_OPERATOR_USER`. Nunca no GitHub.
