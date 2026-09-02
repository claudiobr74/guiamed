<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GuiaMed — Agent Instructions

Este repositório é o produto **GuiaMed**.

## Stack operacional
- Figma: fonte de verdade visual e de UX.
- Firebase: Auth, Firestore, Storage e serviços backend quando necessários.
- Vercel: deploy da aplicação web e ambientes Preview/Production.
- GitHub: versionamento, branches, Pull Requests e CI.

## Regra principal
Antes de alterar código:
1. leia a estrutura atual do repositório;
2. leia as regras aplicáveis em `.cursor/rules/`;
3. preserve a stack e padrões já existentes;
4. não recrie o projeto;
5. não apague funcionalidades funcionais;
6. não faça alterações destrutivas sem necessidade comprovada.

## GuiaMed
Produto médico para criação de guias/solicitações cirúrgicas a partir de PDFs oficiais de instituições/operadoras.

Requisitos de domínio que nunca podem ser perdidos:
- o PDF oficial original é preservado e preenchido, não redesenhado;
- templates de PDF são versionados;
- cada código/procedimento selecionado possui `quantity`, padrão 1 e editável;
- TUSS, IPASGO e CID vêm de bases estruturadas/oficiais; IA nunca inventa códigos;
- documentos finalizados preservam snapshot histórico;
- dados de saúde são sensíveis e exigem autorização real, não apenas UI escondida;
- alterações no Figma devem ser implementadas com alta fidelidade.

## Forma de trabalho
Para tarefas não triviais:
1. AUDITAR
2. PLANEJAR
3. IMPLEMENTAR
4. TESTAR
5. REVISAR DIFF
6. VERIFICAR VISUAL/FUNCIONALMENTE
7. RELATAR apenas fatos comprovados

Nunca declarar "concluído" sem executar os testes/validações disponíveis no projeto.
