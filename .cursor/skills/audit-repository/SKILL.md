---
name: audit-repository
description: Audita o repositório GuiaMed antes de alterar código. Use sempre no início de tarefas não triviais.
---

# Audit repository

Antes de qualquer mudança:

1. Listar `src/`, `package.json`, Firebase (`src/lib/firebase`, `firestore.rules`, `storage.rules`), testes e `.github/workflows`.
2. Ler `AGENTS.md` e `.cursor/rules/`.
3. Identificar stack real (não a desejada): Next.js, Firebase `guiamed-918ee`, Vercel, GitHub.
4. Classificar telas/fluxos vs Figma: implementado, parcial, ausente, risco.
5. Não redesenhar. Não trocar a stack. Não apagar o que funciona.

Entregar gap analysis objetivo. Só então planejar patches mínimos.
