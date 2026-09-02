# GuiaMed

Aplicação web para preenchimento de guias e documentos cirúrgicos a partir do PDF original da instituição.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Firebase (projeto `guiamed-918ee`): Authentication, Cloud Firestore e Storage
- Vercel (web) e GitHub (PR + CI)
- pdf-lib (escrita) e PDF.js (editor visual)
- Regras do produto em `AGENTS.md` e `.cursor/rules/`

## Desenvolvimento

1. Copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_FIREBASE_API_KEY` e a credencial Admin do projeto `guiamed-918ee`.
3. No Console Firebase, ative Authentication (e-mail/senha), Firestore e Storage.

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000`, crie a organização em `/register` e use o fluxo:

Login → Paciente → Instituição/template → Diagnóstico/CID → Procedimentos → Justificativa → Preview → PDF → Histórico.

## Firebase

O app fala com o Firebase **só no servidor** (Admin SDK). Regras de Firestore e Storage negam acesso direto pelo cliente. Tenancy é aplicada nas consultas (`organizations/{orgId}/...`) com o `organizationId` da sessão.

Para publicar as regras:

```bash
firebase deploy --only firestore:rules,storage
```

Não importe tabelas TUSS/IPASGO inventadas. Use o arquivo oficial em CSV/XLSX/JSON na tela **Tabelas**.

## Testes

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```
