# Gerador de TCE

Rota da tela: `/gerador-tce`.

## O que faz
Abre o gerador de TCE em `https://dnaworkia-tce-gerador.vkfaze.easypanel.host/`. Esta página não gera termo, não consulta empresa e não grava candidato. O gerador é outro app, no EasyPanel.

## Arquivos desta página
- `next.config.ts` — redireciona `/gerador-tce` para o gerador antes de montar a tela.
- `src/app/gerador-tce/page.tsx` — o mesmo destino, se a rota for aberta sem o redirecionamento do config.
- `src/components/AppShell.tsx` — item Gerador de TCE na aba lateral. O clique carrega a rota de novo para o redirecionamento sair do app.
