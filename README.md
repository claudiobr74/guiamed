# GuiaMed

Aplicação web para preenchimento de guias e documentos cirúrgicos a partir do PDF original da instituição.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- PostgreSQL via PGlite em desenvolvimento e Supabase em produção
- pdf-lib (escrita) e PDF.js (editor visual)

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000`, crie a organização em `/register` e use o fluxo:

Login → Paciente → Instituição/template → Diagnóstico/CID → Procedimentos → Justificativa → Preview → PDF → Histórico.

## Produção (Supabase)

1. Crie um projeto Supabase **exclusivo do GuiaMed**.
2. Aplique `supabase/migrations/0001_init.sql` e `0002_storage.sql`.
3. Configure as variáveis de `.env.example`.
4. Confirme que os buckets `pdf-templates`, `generated-documents` e `signatures` são **privados**.

Não importe tabelas TUSS/IPASGO inventadas. Use o arquivo oficial em CSV/XLSX/JSON na tela **Tabelas**.

## Testes

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```
