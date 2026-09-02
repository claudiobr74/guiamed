---
name: github-pr
description: Abre ou atualiza PR do GuiaMed com gates e descrição factual.
---

# GitHub PR

- Branch a partir da base do ambiente. Commits descritivos em português.
- Rodar `pnpm lint`, `typecheck`, `test`, `build` antes de considerar pronto.
- Corpo da PR: o que mudou, riscos de domínio/segurança, como testar, variáveis Firebase.
- Não incluir secrets. Não usar CLI de forge se o ambiente exigir a ferramenta de PR nativa.
