# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-02

## Estado

- Base auditada: `origin/cursor/guiamed-app-e951` em `2c14a3d`.
- Branch de trabalho: `fix/core-clinical-workflow`.
- Último teste: `vitest run` — 57/57 PASS.
- Gates locais: lint PASS; typecheck PASS; build bloqueado por instalação local incompleta de dependências (o lockfile contém `rolldown@1.2.7`, ainda dentro da política de idade mínima do ambiente). O CI remoto da base estava verde.

## Concluído neste checkpoint

- schema backward-compatible de `ProcedureCode.defaultQuantity` e `healthInsurerId`;
- snapshots adicionais de descrição e versão TUSS/IPASGO;
- resolvedor determinístico por procedimento, sistema, vigência, versão e operadora;
- quantidade padrão do código aplicada na seleção manual;
- validação central server-side de pré-finalização;
- nome enganoso `withRls` substituído por `withOrganizationContext` com identidade obrigatória;
- testes unitários de resolução, quantidade e validação de finalização.

## Próxima tarefa exata

Implementar materialização server-side única de itens para seleção manual e kits, revalidando `procedureId`, códigos, vigência, operadora e quantidade antes de salvar. Depois corrigir o editor de kits para persistir TUSS e IPASGO separadamente e adicionar o teste obrigatório com quantidades 1, 2 e 4.

Arquivos principais:

- `src/lib/codes.ts`
- `src/lib/db/repos.ts`
- `src/app/actions.ts`
- `src/features/requests/RequestEditor.tsx`
- `src/app/kits/page.tsx`
- `src/types/domain.ts`

## Pendências

### P0

- materialização e validação server-side de itens/códigos;
- gerenciador administrativo de vínculos;
- importação em lote com preview completo e preservação de vínculos;
- kits com códigos e quantidades corretas;
- filtro/invalidação automática de template na UI;
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
