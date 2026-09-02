# GuiaMed Cursor Kit

Este pacote deve ser extraído **na raiz do repositório**.

Estrutura:

```text
AGENTS.md
.cursor/
  rules/
    00-core-engineering.mdc
    10-figma-fidelity.mdc
    20-typescript-frontend.mdc
    30-firebase-security.mdc
    40-github-workflow.mdc
    50-vercel-deployment.mdc
    60-testing-release.mdc
    70-medical-domain.mdc
  skills/
    audit-repository/SKILL.md
    implement-from-figma/SKILL.md
    firebase-feature/SKILL.md
    firebase-security-review/SKILL.md
    pdf-template-engine/SKILL.md
    github-pr/SKILL.md
    vercel-deploy-verify/SKILL.md
    debug-root-cause/SKILL.md
  agents/
    figma-implementation-reviewer.md
    firebase-security-auditor.md
    release-verifier.md
```

## Stack esperado
- Figma → design/UX
- Firebase → Auth, Firestore, Storage e backend quando adequado
- Vercel → web deploy, Preview e Production
- GitHub → source control, PR e CI

## Como instalar
1. Faça backup/commit do estado atual.
2. Extraia o ZIP na raiz.
3. Confirme que a pasta `.cursor` ficou na raiz, ao lado de `package.json`/app.
4. Reinicie/recarregue o workspace do Cursor se necessário.
5. Versione esses arquivos no Git para compartilhar o comportamento com o projeto.

## Primeira mensagem sugerida no Cursor

```text
Leia AGENTS.md e todas as regras do projeto. Execute a skill audit-repository.
Audite o repositório antes de alterar qualquer código. Depois compare o estado
atual do GuiaMed com o Figma e me entregue um gap analysis objetivo:
implementado, parcial, ausente e risco. Não faça redesign e não mude a stack.
```

Depois da auditoria, para implementar uma tela:

```text
Use a skill implement-from-figma e implemente esta tela com fidelidade ao Figma.
Preserve o framework e componentes existentes. Ao terminar, delegue a revisão
ao subagent figma-implementation-reviewer e execute os gates do projeto.
```

Para mudanças Firebase:

```text
Use a skill firebase-feature. Atualize dados, validação e Security Rules juntos.
Depois delegue ao firebase-security-auditor e corrija achados Critical/High antes
de considerar a feature concluída.
```
