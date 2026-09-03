# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-03

## Estado atual

- Base: `cursor/guiamed-app-e951` em `2c14a3d`.
- Branch: `fix/core-clinical-workflow`.
- PR #2: aberto, **draft**, mergeable, `main` intocado.
- Head funcional validado: `9f799e32a5b38cbb67eeec0bbf2c91646a85dee2`.
- GitHub Actions CI #128: **SUCCESS** — lint PASS, typecheck PASS, Vitest **128/128 PASS em 29 arquivos**, fixtures PDF publicadas e build Next.js 16.3.4/Turbopack PASS.
- Artifact CI #128: `pdf-fixtures-2`, ID `9905442349`.
- E2E autenticado #111: `configuration` PASS; `browser-flow` **SKIPPED** porque os seis secrets `E2E_*` continuam ausentes. Não considerar E2E PASS.
- Vercel: novos deployments continuam bloqueados pelo `build-rate-limit` do plano; isso não representa falha de compilação. O último preview anterior disponível foi bem-sucedido.

## Concluído no fluxo crítico

### Guia clínica e finalização

- resolução determinística TUSS/IPASGO por procedimento, sistema, vigência, versão e convênio;
- quantidade padrão por código/kit, editável e podendo ser >1;
- materialização server-side e rejeição de snapshots/códigos adulterados;
- CID-10 oficial com busca, normalização e warnings informativos;
- autosave serializado por revisão monotônica;
- compatibilidade de template com instituição/convênio;
- checklist ligado à validação server-side;
- confirmação médica vinculada à revisão finalizada;
- finalização transacional com usuário, timestamp, revisão, hash e snapshot histórico;
- guia finalizada read-only, duplicação segura e cancelamento auditável;
- visualização histórica baseada em snapshot imutável, sem depender de cadastros vivos posteriores.

### Administração, auditoria e Firestore

- pacientes e guias paginados/batch-hydrated;
- médicos, instituições, convênios, procedimentos, kits, templates e códigos paginados;
- buscas grandes usam índice normalizado e consultas direcionadas;
- guide autosave, kits e importações não varrem catálogos inteiros;
- vínculos TUSS/IPASGO pesquisados sob demanda e rejeitados contra registros inativos;
- importação CSV/XLSX/JSON com preview, chunks, indexação e preservação de vínculos;
- actions administrativas antigas sem consumidores removidas de `src/app/actions.ts`;
- audit logs administrativos cobrem importações, vínculos, kits, instituições, convênios, procedimentos, médicos, assinaturas, templates, mappings, repeaters e configurações.

### PDF / Template Studio

- upload validado antes de leitura integral, com assinatura PDF, tamanho, páginas, estrutura e rate limit;
- Storage privado e leitura por rota autenticada;
- mappings e repeaters auditados e validados;
- PDF.js com worker local e Pointer Events;
- métricas reais, wrap, auto-shrink e overflow explícito sem truncamento silencioso;
- múltiplos repeaters como continuação sequencial;
- AcroForm tipado para TextField, checkbox, radio, dropdown e option list;
- `@pdf-lib/fontkit` + Liberation Sans para Unicode real;
- glifos realmente ausentes bloqueados explicitamente;
- criação/movimento/redimensionamento por mouse, toque e Apple Pencil;
- **alternativa por teclado concluída**: criação sem desenhar, setas para mover, setas no handle para redimensionar, `Shift` para passo de 10 pt e clamp nos limites da página;
- testes puros de geometria do teclado adicionados.

### Acessibilidade e responsividade

- `Field` associa rótulo ao controle;
- drawer móvel com foco contido, Escape e restauração;
- `Modal` com nome acessível, focus trap, Escape, restauração de foco e scroll lock;
- etapas do editor com `aria-current`, regiões vivas e alertas;
- tabelas críticas com overflow controlado em telas menores;
- login e fluxo clínico principal melhorados para teclado/leitor de tela;
- Template Studio agora possui alternativa funcional de teclado para a edição geométrica principal.

### Next.js / operação

- migração `src/middleware.ts` → `src/proxy.ts` concluída no Next.js 16.3.4;
- teste dedicado do Proxy cobre redirect sem sessão e passagem de rotas públicas/autenticadas;
- o aviso de depreciação de `middleware` desapareceu do build;
- README operacional final atualizado com arquitetura, segurança, E2E, templates, deploy, reindexação e critérios de promoção.

### Fixtures PDF sintéticas

O CI publica quatro PDFs 100% sintéticos, sem dados reais de paciente:

1. overlay Unicode;
2. AcroForm com texto/checkbox/radio/dropdown;
3. assinatura PNG sintética;
4. repeater multipágina com 7 procedimentos (5 + 2).

## Pendências reais

### P0 externo

1. Configurar os seis secrets de teste e obter o primeiro `browser-flow` autenticado real:
   - `E2E_FIREBASE_SERVICE_ACCOUNT`
   - `E2E_FIREBASE_API_KEY`
   - `E2E_FIRESTORE_DATABASE_ID`
   - `E2E_FIREBASE_STORAGE_BUCKET`
   - `E2E_USER_EMAIL`
   - `E2E_USER_PASSWORD`
2. Obter PDFs oficiais reais/anonimizados autorizados para validar valores específicos de checkbox/radio/dropdown e políticas de overflow.

### P1 interno

1. Fazer comparação sistemática do produto atual com o Figma, priorizando login, dashboard, lista/editor de guias e Template Studio, sem regredir responsividade/acessibilidade.
2. Fazer inspeção dinâmica autenticada do preview hospedado quando a cota Vercel voltar.

### P2

- refinamentos visuais encontrados na comparação Figma que não alterem o fluxo clínico;
- avaliar build cache do GitHub Actions/Vercel e atualização futura dos actions runners quando necessário.

## Commits desta retomada

- `e8c97bf` — helper de geometria por teclado;
- `961940c` — testes da geometria por teclado;
- `7eaf399` — controles de teclado integrados ao Template Studio; CI #124 PASS;
- `d9e6caf` / `13b4040` / `36f0330` — migração inicial middleware → proxy;
- `a3c2cdd` — correção do teste do Proxy para a API realmente disponível no Next 16.3.4;
- `9f799e3` — README operacional; **CI #128 PASS, 128/128 testes, build verde**.

## Próxima tarefa exata

**Comparar sistematicamente as telas atuais com o Figma e corrigir somente divergências visuais/ergonômicas relevantes, preservando as melhorias já concluídas de responsividade, acessibilidade e segurança.**
