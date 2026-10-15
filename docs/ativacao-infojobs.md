# Ativação Infojobs

Rota da tela: `/ativacao-infojobs`.

## O que faz
Abre o painel Pandapé → Bwipo CRM em `https://dnaworkia-disparador-infojobs.vkfaze.easypanel.host/`. Esta página não consulta vaga, não grava candidato e não chama o CRM. O painel é outro app, no EasyPanel.

## Arquivos desta página
- `next.config.ts` — redireciona `/ativacao-infojobs` para o painel antes de montar a tela.
- `src/app/ativacao-infojobs/page.tsx` — o mesmo destino, se a rota for aberta sem o redirecionamento do config.
- `src/components/AppShell.tsx` — item Ativação Infojobs na aba lateral. O clique carrega a rota de novo para o redirecionamento sair do app.
