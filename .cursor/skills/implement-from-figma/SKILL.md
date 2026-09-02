---
name: implement-from-figma
description: Implementa uma tela do GuiaMed com fidelidade ao Figma oficial, reusando componentes existentes.
---

# Implement from Figma

1. Extrair `fileKey` e `nodeId` da URL (`HtieMr0OFOgb3EYa3jCAlL`; `node-id` com `-` vira `:`).
2. Carregar skill Figma `figma-design-to-code` e chamar `get_design_context`.
3. Reusar `src/components/ui.tsx`, `AppShell`, `Sidebar` e tokens de `globals.css`.
4. Adaptar o código de referência ao App Router / TypeScript do repo. Não colar o output.
5. Preservar fluxo médico: PDF original, quantity, códigos oficiais.
6. Ao terminar, revisar com o agente `figma-implementation-reviewer` e rodar os gates.
