# Banco de Candidatos

Rotas: `/banco-candidatos` (lista) e `/banco-candidatos/[id]` (detalhe + Demitir). A lista carrega sozinha. **Ver Detalhes** abre a página do candidato. Lista, opções e detalhe ficam em `sessionStorage` por 10 minutos; voltar à tela usa o cache. Os filtros aplicados (e a página) ficam na sessão até **Limpar filtros** ou fechar a aba. **Buscar** força atualização. Depois de demitir, o cache da lista é limpo.

Demitir só aparece se houver contratação ativa (`conratacaovaga.status = 1`) e a vaga for estágio (`tipo_vaga = 1`). Sem isso, o formulário não entra.

## O que faz
Consulta o banco de talentos do legado DNA Work (`dna_work` no MySQL Lightsail/RDS). Só lê na lista. Demitir (estágio) gera **um** documento, a Rescisão estágio ensino médio, e grava no legado na mesma transação para o sistema antigo não quebrar.

A lista pagina no MySQL: `COUNT(*)` com os mesmos filtros e depois `LIMIT 50 OFFSET`. Não puxa a base inteira. Nome só entra com 3+ letras; a busca ignora acento (`Araujo` acha `Araújo`) e aceita o texto no meio do nome. Salário e raio só entram se preenchidos.

Cada linha: encaminhado (sim/não, `emcaminhamento.reprovado IS NULL`), nome, idade, término, tipo de ensino (`flex`), instituição, curso, bairro, cidade, estado, cadastro. Distância em km só se a busca usou CEP+raio.

Status (`vw_candidato_status`: `disponivel`, `encaminhado`, `contratado`, `demitido`; default `todos`) continua igual: filtro pelos EXISTS da view, sem gravar status.

**Gerar prévia** é opcional e abre `/banco-candidatos/previa` em página inteira (sem aba lateral) para leitura. A demissão pode ser gravada direto, sem abrir a prévia. A barra tem **Imprimir** (janela de impressão) e **Salvar em PDF** (download do arquivo). Sem marca DNAWORK e sem Ref. no documento. Depois de salvar a demissão, a ficha recarrega documentos e ocorrências. A aba de Sim/Não (`/banco-candidatos/documento/[id]/confirmar`) abre no clique com “Gerando a rescisão…”, para o navegador não bloquear o popup e a tela não ficar em branco. **Não** fecha essa aba; o envio fica para depois em `/banco-candidatos/documento/[id]`. **Voltar à lista** na aba do documento também fecha a aba, sem abrir a lista de novo. A ficha sempre mostra documentos (`contratos_gerados` + `texto_contrato`) e ocorrências. Não gera Termo de Compromisso de Estágio. Não remarca status do candidato nesta tela.

Demitir pede motivo em contrato (só as 2 frases), data, avaliação de desempenho, resumo das atividades (pré-preenche `vaga.atribu_contrato`, quebrando itens que o legado cola sem espaço) e motivo interno (não entra no documento). Bloqueia se já existir `demissao` para o mesmo `id_candidato` + `id_vaga`. Só gera documento quando `vaga.tipo_vaga = 1` (Estágio).

## Documento
Um único termo, o texto do PDF Recisão Modelo Novo (`templates/recisao-modelo-novo.html`), gravado com o nome **Rescisão estágio ensino médio**. Não usa os termos antigos nem a tabela `cabecalho`. Só preenche os buracos. Endereço da DNA Work é o do modelo (R. do Bosque, 1621, Loja 02, São Paulo/SP, CEP 01136-001, CNPJ 40.380.163/0001-61). `Ref.: TCE/[código]` vem do TCE já existente. Data do TCE nos considerandos = `conratacaovaga.datafim`. Cláusula 3 (ii) = `datainicio` até a data da demissão. Tipo de estágio marca `( X )` em Não Obrigatório. Avaliação é escolhida por botões. Resumo (cláusula 3-i) vem de `vaga.atribu_contrato`. O HTML vai para `texto_contrato` com `#corpo` e estilo inline (tabelas), para o `imprimir-contrato.php` do legado não gerar PDF em branco. `contratos_gerados.chave` recebe `UUID()`, como no legado.

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

## Assinatura digital (ZapSign)
Um clique cria **um** envelope em `POST https://api.zapsign.com.br/api/v1/docs/`. O PDF vai em `base64_pdf` puro (sem `data:application/pdf;...`). `external_id` do documento = `{agente}+{id_contratogerado}` (agente **127**). `folder_path` = `/dna-work/{Nome-Candidato}/`. Recebem e-mail (`tokenEmail`): estagiário, responsável legal se menor de 18, empresa (`assinaturas_empresa` tipo TCE) e escola só se `instituicao.assina_digital = 1`. O mesmo e-mail entra uma vez. DNA entra no envelope com `assinaturaTela` e **sem** e-mail automático. A tela de acompanhamento não abre a ZapSign.

Sem `ZAPSIGN_USER_TOKEN`, a automática da DNA não roda: o envio das outras partes segue e a tela avisa. Com o token, `POST /api/v1/sign/`. O usuário ZapSign precisa ter nome, sobrenome, telefone e assinatura em Meu perfil; se faltar, a tela mostra o erro da ZapSign. **Atualizar status** tenta assinar a DNA de novo. Grava `assinatura_digital` + `assinatura_digital_assinantes`. Já existe linha para o `id_contratogerado` = não envia de novo. **Atualizar status** faz `GET /docs/{token}/`. **Reenviar e-mail** no signer externo. Webhook próprio: `POST /api/webhooks/zapsign`.

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
- `src/banco-candidatos/assinatura.ts`
- `src/lib/dna-work-db.ts`
- `src/lib/zapsign.ts`
- `src/app/api/banco-candidatos/route.ts`
- `src/app/api/banco-candidatos/opcoes/route.ts`
- `src/app/api/banco-candidatos/[id]/route.ts`
- `src/app/api/banco-candidatos/demitir/route.ts`
- `src/app/api/banco-candidatos/documento/[id]/assinatura/route.ts`
- `src/app/api/webhooks/zapsign/route.ts`
- `templates/recisao-modelo-novo.html`

## Variáveis
`DNA_WORK_DB_HOST`, `DNA_WORK_DB_PORT`, `DNA_WORK_DB_USER`, `DNA_WORK_DB_PASS`, `DNA_WORK_DB_NAME`. Opcional: `DNA_WORK_OPERATOR_USER`. ZapSign só no EasyPanel / `.env.local`: `ZAPSIGN_API_TOKEN`, `ZAPSIGN_API_URL`, `ZAPSIGN_USER_TOKEN` (vazio até configurar), `ZAPSIGN_AGENTE_ID=127`. Nunca no GitHub.
