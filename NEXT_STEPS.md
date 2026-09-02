# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-02

## Estado

- Base auditada: `origin/cursor/guiamed-app-e951` em `2c14a3d`.
- Branch de trabalho: `fix/core-clinical-workflow`.
- Último teste: `vitest run` — 65/65 PASS.
- Gates locais: lint PASS; typecheck PASS. O primeiro commit passou também no CI e build remotos; o próximo commit deve ser novamente validado pelo CI.

## Concluído neste checkpoint

- schema backward-compatible de `ProcedureCode.defaultQuantity` e `healthInsurerId`;
- snapshots adicionais de descrição e versão TUSS/IPASGO;
- resolvedor determinístico por procedimento, sistema, vigência, versão e operadora;
- quantidade padrão do código aplicada na seleção manual;
- validação central server-side de pré-finalização;
- nome enganoso `withRls` substituído por `withOrganizationContext` com identidade obrigatória;
- testes unitários de resolução, quantidade e validação de finalização.
- materialização server-side de itens e rejeição de códigos adulterados/incompatíveis;
- kits agora resolvem TUSS/IPASGO na UI e são revalidados no servidor;
- teste obrigatório de kit com quantidades 1, 2 e 4;
- reimportação preserva vínculo, operadora e quantidade existentes e não confirma vínculo automaticamente;
- template filtrado/invalidationado por instituição e convênio, com seleção automática quando único;
- novo paciente propaga o convênio para a guia.

## Próxima tarefa exata

Implementar concorrência otimista do autosave com revisão monotônica e retornar o rascunho materializado ao cliente. Depois persistir confirmação médica e snapshot histórico consolidado na transação de finalização.

Arquivos principais:

- `src/lib/codes.ts`
- `src/lib/db/repos.ts`
- `src/app/actions.ts`
- `src/features/requests/RequestEditor.tsx`
- `src/app/kits/page.tsx`
- `src/types/domain.ts`

## Pendências

### P0

- gerenciador administrativo de vínculos;
- importação em lote com preview completo e preservação de vínculos;
- editor administrativo de kits com escolha explícita de códigos e quantidade por item;
- confirmação médica persistida;
- snapshot histórico consolidado;
- correção cross-tenant em `createTemplateVersion` e autorização por recurso no download;
- testes de integração/E2E e Preview autenticado.

### P1

- overflow/alinhamento/métricas reais/AcroForm/Unicode no PDF;
- worker PDF.js local e Pointer Events no mapper;
- paginação/busca indexada/debounce;
- upload robusto, hash verificado e rate limiting.

### P2

- refinamentos responsivos e acessibilidade após estabilização do fluxo crítico;
- migração do `middleware` para `proxy` após validar comportamento no Next.js 16.
