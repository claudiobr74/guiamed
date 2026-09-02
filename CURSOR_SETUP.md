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
