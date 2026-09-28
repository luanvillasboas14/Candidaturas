# Gerador de currículo

Rota da tela: `/gerador-curriculo`.

## O que faz
Monta um currículo em etapas e baixa em PDF. Não grava no CRM nem no banco: tudo fica no navegador até o download.

A primeira etapa escolhe modelo e cor. Depois: cabeçalho, formação, histórico, competências, objetivo e finalizar (dá para trocar modelo e cor de novo). Não avança se o passo atual estiver incompleto. Foto é opcional. A prévia fica ao lado do formulário e usa a largura da tela.

Campos do cabeçalho: nome, telefone (E.164), e-mail, cidade, UF, bairro, nascimento e foto opcional (até 800 KB). Formação: nível, instituição, situação e anos; em ensino fundamental e médio a situação é Completo, Incompleto ou Cursando, e o curso só aparece em técnico ou superior. Experiência: empresa, cargo, cidade, período (mm/aaaa), trabalho atual e atividades. Competências: frases prontas por setor (atendimento, administrativo, operação e comportamental), mais texto livre. Idiomas, certificados, afiliações, conquistas, informações adicionais e sites são opcionais. Objetivo: texto livre, com quebra automática de linha no PDF.

Modelos: ATS (coluna única para Gupy), Clássico, Moderno, Executivo, Lateral, Barra direita, Linha do tempo, Minimalista e Compacto. Cores: DNA, azul, verde, vinho, grafite, roxo, vermelho, rosa, ciano, mostarda, marinho, terracota, oliva e preto. Na escolha do modelo a prévia usa dados fictícios. O PDF sai da prévia visível (`html2pdf.js`) em uma página; a segunda só aparece se o conteúdo passar da folha.

## Arquivos desta página
- `src/app/gerador-curriculo/page.tsx` — tela.
- `src/gerador-curriculo/GeradorCurriculo.tsx` — etapas e formulário.
- `src/gerador-curriculo/CurriculoPreview.tsx` — prévia A4.
- `src/gerador-curriculo/modelos.ts` — modelos e cores.
- `src/gerador-curriculo/frases.ts` — frases prontas de competências.
- `src/gerador-curriculo/exemplo.ts` — currículo fictício da prévia inicial.
- `src/gerador-curriculo/types.ts` — tipos e listas (UF, níveis).
- `src/gerador-curriculo/pdf.ts` — download do PDF.
