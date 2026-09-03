# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-03

## Estado atual

- Base auditada: `origin/cursor/guiamed-app-e951` em `2c14a3d`.
- Branch de trabalho: `fix/core-clinical-workflow`.
- Último head funcional validado: `59f085a0710c45a8042092c0a5a1f9bd9c5f5746`.
- GitHub Actions CI #115: **SUCCESS** — install PASS, lint PASS, typecheck PASS, Vitest **121/121 PASS em 27 arquivos**, publicação das fixtures PASS e build Next.js 16.3.4/Turbopack PASS.
- Artifact do CI #115: `pdf-fixtures-2`, ID `9902879548`, com quatro PDFs 100% sintéticos + `manifest.json`.
- Vercel do mesmo head: **SUCCESS**. O preview foi criado; a conexão Vercel disponível nesta sessão não conseguiu abrir diretamente o projeto/preview, portanto não registrar inspeção visual hospedada como concluída.
- E2E autenticado #98: configuração PASS, mas `browser-flow` **SKIPPED** porque os seis secrets `E2E_*` ainda não estão configurados. Não considerar E2E PASS.
- `main` permanece intocado; PR #2 continua aberto, em draft, contra `cursor/guiamed-app-e951`.

## Concluído no fluxo crítico

### Guia clínica e finalização

- resolvedor determinístico TUSS/IPASGO por procedimento, sistema, vigência, versão e convênio;
- quantidade padrão por código e por kit, sempre editável e podendo ser >1;
- materialização server-side dos itens e rejeição de snapshots/códigos adulterados;
- CID-10 oficial com normalização do snapshot, busca e warnings informativos;
- autosave serializado por revisão monotônica, sem sobrescrita por resposta atrasada;
- template compatível com instituição/convênio e invalidação automática quando o contexto muda;
- checklist final ligado à validação server-side;
- finalização transacional com confirmação médica, usuário, timestamp, revisão, hash e snapshot histórico;
- guia finalizada realmente read-only;
- duplicação segura e cancelamento com motivo/auditoria;
- abertura, preview e renderização hidratam paciente, médico, instituição e convênio diretamente pelos IDs, sem scans de coleções;
- guia finalizada não carrega catálogos administrativos que não podem ser editados.

### Administração, auditoria e Firestore

- pacientes e guias paginados/batch-hydrated;
- médicos paginados em 50 por página;
- instituições e convênios paginados independentemente em 50 por página;
- procedimentos canônicos paginados em 50, lendo códigos apenas dos itens visíveis;
- vínculos TUSS/IPASGO hidratam apenas relações atuais e pesquisam novas relações sob demanda;
- servidor rejeita novos vínculos com procedimento/operadora inativos;
- kits paginados em 20 e editor pesquisa procedimentos sob demanda;
- templates paginados em 20 e versões históricas são consultadas apenas dos itens visíveis;
- upload de template pesquisa instituição/operadora sob demanda e rejeita associação a registro inativo;
- catálogo TUSS/IPASGO paginado; importação CSV/XLSX/JSON usa preview, chunks e indexação;
- dashboard lê somente seis kits, em vez da coleção completa, e o rótulo foi corrigido de “Kits mais utilizados” para “Kits disponíveis”.

Audit logs administrativos agora cobrem:

- importação TUSS/IPASGO, com lote/sistema/versão/arquivo e contagens;
- alteração de vínculo TUSS/IPASGO com estado `before/after`;
- criação/edição de kits;
- criação/edição de instituições;
- criação/edição de convênios/operadoras;
- criação/edição de procedimentos canônicos;
- criação/edição de médicos, incluindo troca do médico padrão, sem duplicar telefone/e-mail no metadata de auditoria;
- upload/versionamento de templates;
- alteração de repeaters do Template Studio;
- configurações da organização com `before/after` e campos alterados;
- upload/remoção de assinatura médica, já auditados anteriormente.

**Buraco conhecido:** alterações de `mappings` do PDF ainda usam a action legada `saveMappingsAction` de `src/app/actions.ts` e ainda precisam ser migradas para a trilha auditada.

### PDF / Template Studio

- upload validado antes de `arrayBuffer`, assinatura PDF, tamanho, páginas, estrutura e rate limit;
- Storage privado e rota autenticada com sessão/tenant/vínculo;
- PDF.js com worker local e Pointer Events;
- mappings editáveis com posição, tamanho, página, fonte, alinhamento, multiline, auto-shrink, required e maxCharacters;
- repeaters editáveis e validados;
- métricas reais de texto, wrap e auto-shrink;
- overflow horizontal/vertical/maxCharacters bloqueia geração sem truncamento silencioso;
- múltiplos repeaters como continuação sequencial;
- AcroForm tipado para TextField, checkbox, radio, dropdown e option list;
- `@pdf-lib/fontkit` + Liberation Sans embarcada para Unicode real em overlay e AcroForm;
- glifos realmente ausentes continuam bloqueados explicitamente.

### Fixtures PDF sintéticas

O CI gera quatro PDFs sem dados reais de paciente:

1. `01-overlay-unicode.pdf` — overlay Unicode, alinhamento, multiline e CID;
2. `02-acroform-controls.pdf` — TextField Unicode, checkbox, radio e dropdown;
3. `03-signature-image.pdf` — assinatura PNG totalmente sintética;
4. `04-multipage-repeaters.pdf` — 7 procedimentos, distribuídos em 5 + 2 linhas.

A inspeção visual inicial das fixtures a 160 dpi confirmou ausência de clipping/sobreposição/glifos quebrados, controles AcroForm coerentes, assinatura contida e continuação multipágina correta. O CI continua publicando essas fixtures como artifact a cada execução.

### Segurança HTTP

- CSP global adicionada com `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, `connect-src 'self'` e `worker-src 'self' blob:`;
- sem `unsafe-eval` e sem abertura de domínios externos no browser;
- `unsafe-inline` mantido apenas para compatibilidade atual do runtime Next/estilos;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- Referrer-Policy, COOP, CORP, Permissions-Policy e HSTS;
- teste dedicado `src/lib/security/headers.test.ts` protege as diretivas críticas contra regressão;
- build e testes passaram com a política nova.

## Próxima tarefa exata

1. Fechar a auditoria dos `mappings` do PDF e revisar/remover/delegar as actions administrativas legadas duplicadas em `src/app/actions.ts`, sem reescrever o mapper de forma arriscada.
2. Fazer auditoria de acessibilidade/responsividade nas telas de maior uso: login, dashboard, lista/editor de guias e Template Studio.
3. Validar com templates oficiais reais/anonimizados os valores de checkbox/radio/dropdown e a política de overflow por formulário.
4. Configurar os seis secrets Firebase de teste e executar o primeiro `browser-flow` real.
5. Depois, migrar `middleware` → `proxy` com teste dedicado no Next.js 16 e concluir README operacional.

## Pendências externas

- `E2E_FIREBASE_SERVICE_ACCOUNT`;
- `E2E_FIREBASE_API_KEY`;
- `E2E_FIRESTORE_DATABASE_ID`;
- `E2E_FIREBASE_STORAGE_BUCKET`;
- `E2E_USER_EMAIL`;
- `E2E_USER_PASSWORD`;
- PDFs oficiais reais/anonimizados autorizados para validar valores específicos de controles e overflow.

## Commits recentes desta fase

- `274773c` — fixtures PDF publicadas no CI;
- `ef3584c` — auditoria inicial de importação/vínculos/kits;
- `c70e517` / `e4e0939` / `aef8a36` / `8eea833` — actions auditadas de instituições, convênios e procedimentos;
- `10bb84d` — auditoria de upload/versionamento de template e repeaters;
- `89c756f` / `fe5fe45` / `f983f88` — auditoria de criação/edição de médicos;
- `19ff0a3` — auditoria enriquecida das configurações da organização; CI #112 PASS;
- `a2e51b4` / `2c9f219` — headers/CSP e testes de segurança; CI #114 PASS;
- `59f085a` — dashboard limitado a seis kits e rótulo factual; **CI #115 PASS, 121/121 testes, Vercel SUCCESS**.
