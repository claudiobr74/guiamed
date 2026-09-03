# LizaCare (repo GuiaMed) — continuidade objetiva

Atualizado em: 2026-09-03

## Estado atual

- Base: `cursor/guiamed-app-e951` em `2c14a3d`.
- Branch: `fix/core-clinical-workflow`.
- PR #2: aberto, **draft**, mergeable, `main` intocado.
- Head funcional validado: `597bae7033dd4cf9e022238161e49e906f683640`.
- GitHub Actions CI #201: **SUCCESS** — lint sem warnings, typecheck PASS, Vitest **151/151 PASS em 33 arquivos**, fixtures PDF publicadas e build Next.js 16.3.4/Turbopack PASS.
- Artifact CI #201: `pdf-fixtures-2`, ID `9911845458`.
- E2E autenticado #184: `configuration` PASS; `browser-flow` **SKIPPED** porque os seis secrets `E2E_*` continuam ausentes. Não considerar E2E PASS.
- Vercel: o head atual continua sem deploy porque a conta está em `build-rate-limit`; isso não representa falha de compilação.
- Branding visual: LizaCare aplicado; login usa o mesmo asset canônico do restante do app. Nomes técnicos (`guiamed`, Firebase, paths/coleções) permanecem inalterados.

## Concluído no fluxo crítico

### Guia clínica e finalização

- resolução determinística TUSS/IPASGO por procedimento, sistema, vigência, versão e convênio;
- vigência corrigida para comparação inclusiva por **data clínica**, sem expirar códigos no meio do último dia;
- quantidade padrão por código/kit, editável e podendo ser >1;
- código preferencial de kit respeitado somente no sistema correto, com fallback determinístico se inválido/expirado;
- materialização server-side e rejeição de snapshots/códigos adulterados;
- CID-10 oficial com busca, normalização e warnings informativos;
- autosave serializado por revisão monotônica;
- compatibilidade de template com instituição/convênio;
- checklist ligado à validação server-side;
- confirmação médica vinculada exatamente à revisão validada/finalizada;
- finalização transacional com usuário, timestamp, revisão, hash e snapshot histórico;
- guia finalizada read-only, duplicação segura e cancelamento auditável;
- tela e preview de documento finalizado usam snapshot imutável, sem depender de cadastros vivos posteriores.

### Administração, auditoria e Firestore

- pacientes e guias paginados/batch-hydrated;
- médicos, instituições, convênios, procedimentos, kits, templates e códigos paginados;
- buscas grandes usam índice normalizado e consultas direcionadas;
- vínculos TUSS/IPASGO pesquisados sob demanda e rejeitados contra registros inativos;
- importação CSV/XLSX/JSON com preview, encoding CSV, vigência validada/normalizada e preservação de vínculos;
- importação limitada explicitamente a 3 MB no transporte Server Action atual, com rate limit e erro recuperável no painel;
- lote de importação registra `failed`, progresso parcial e código de falha se uma escrita Firestore interromper o processamento;
- actions administrativas antigas sem consumidores removidas de `src/app/actions.ts`;
- audit logs administrativos cobrem importações, vínculos, kits, instituições, convênios, procedimentos, médicos, assinaturas, templates, mappings, repeaters e configurações.

### PDF / Template Studio

- upload de templates redesenhado para **chunks privados de até 3 MB**, mantendo limite total de PDF em 20 MB e evitando o teto de payload da Vercel;
- sessão de upload expira, é ownership-scoped, remontada e validada antes de criar a versão;
- versionamento de template, ativação da nova versão e audit log são transacionais no Firestore;
- bucket Firebase usa formato moderno `.firebasestorage.app` com fallback controlado para `.appspot.com` legado;
- se o Cloud Storage não estiver provisionado, o erro é apresentado no formulário em vez de derrubar a página;
- Storage final privado e leitura por rota autenticada;
- mappings e repeaters auditados e validados;
- PDF.js com worker local e Pointer Events;
- métricas reais, wrap, auto-shrink e overflow explícito sem truncamento silencioso;
- múltiplos repeaters como continuação sequencial;
- AcroForm tipado para TextField, checkbox, radio, dropdown e option list;
- `@pdf-lib/fontkit` + Liberation Sans para Unicode real;
- glifos realmente ausentes bloqueados explicitamente;
- criação/movimento/redimensionamento por mouse, toque, Apple Pencil e teclado;
- teclado: criação sem desenhar, setas para mover/redimensionar, `Shift` para 10 pt e clamp nos limites da página.

### PDF real fornecido para teste

- `guia unimed teste.pdf` foi inspecionado fora do repositório: 1 página, ~0,95 MB, não criptografado, PDF estático sem AcroForm;
- deve ser tratado pelo Template Studio em modo Overlay;
- não contém checkbox/radio/dropdown AcroForm e, portanto, não substitui os fixtures oficiais ainda necessários para validar esses controles nativos.

### Acessibilidade, responsividade e Figma

- `Field` associa rótulo ao controle;
- drawer móvel e `Modal` têm foco contido, Escape e restauração;
- etapas do editor usam `aria-current`, regiões vivas e alertas;
- tabelas críticas têm overflow controlado;
- Template Studio possui alternativa funcional de teclado;
- comparação Figma já gerou ajustes em dashboard, stepper, listas de guias/pacientes/procedimentos, kits, instituições, templates, médicos, configurações e preview clínico;
- melhorias de privacidade/paginação foram preservadas mesmo quando diferem do Figma antigo.

### Next.js / operação

- `src/middleware.ts` migrado para `src/proxy.ts` no Next.js 16.3.4;
- Server Actions configuradas com body limit de 4 MB para suportar chunks binários de 3 MB com margem;
- CSP e headers de segurança globais presentes;
- README operacional documenta arquitetura, segurança, E2E, templates, deploy e critérios de promoção.

## Pendências reais

### P0 externo

1. Configurar os seis secrets de teste e obter o primeiro `browser-flow` autenticado real:
   - `E2E_FIREBASE_SERVICE_ACCOUNT`
   - `E2E_FIREBASE_API_KEY`
   - `E2E_FIRESTORE_DATABASE_ID`
   - `E2E_FIREBASE_STORAGE_BUCKET`
   - `E2E_USER_EMAIL`
   - `E2E_USER_PASSWORD`
2. Liberar a cota/build da Vercel e publicar o head atual.
3. No preview novo, repetir o upload do `guia unimed teste.pdf` e confirmar se o bucket Firebase está realmente provisionado. Se não estiver, provisionar/configurar o Cloud Storage; o código agora informa esse caso explicitamente.
4. Obter PDFs oficiais/anonimizados autorizados que tenham checkbox/radio/dropdown nativos, caso existam nos fluxos reais, para validar valores específicos desses campos.

### P1 interno

1. Migrar importações TUSS/IPASGO **maiores que 3 MB** para transporte resumível/direto, preservando preview e idempotência; o limite atual é deliberadamente explícito e seguro, mas não é a solução final para tabelas grandes.
2. Concluir comparação Figma nas telas clínicas restantes, especialmente Justificativa/Revisão e Template Studio, sem regredir acessibilidade.
3. Revisar filtros avançados da tela Tabelas e ordenação/UX de Kits contra o Master Prompt.
4. Adicionar guard explícito de `project_id` no seed E2E para impedir execução acidental contra projeto Firebase incorreto antes de habilitar os secrets.
5. Evoluir gradualmente o contexto de tenant para reduzir a possibilidade de repository novo esquecer o escopo organizacional.

### P2

- refinamentos visuais restantes;
- build cache do GitHub Actions/Vercel;
- atualização futura dos actions runners quando necessário.

## Últimos checkpoints relevantes

- `6c4abef` — login usa a logo canônica LizaCare; CI #158 PASS;
- `68a2b7a` — preview clínico reorganizado;
- correções subsequentes — vigência clínica, revisão exata, snapshot histórico e código preferencial de kits;
- hardening de template — writer transacional, upload privado particionado, fallback de bucket Firebase;
- `ec1104c` — correção de tipagem do assembler de upload; CI #196 PASS, 148/148 testes;
- `a9e0d78` — hardening das actions de importação;
- `597bae7` — dependências completas no modal de revisão; **CI #201 PASS, 151/151 testes, lint sem warnings**.

## Próxima tarefa exata

**Adicionar guard de projeto ao E2E e, depois, revisar os P1 funcionais restantes da tela Tabelas/Kits enquanto Vercel e secrets E2E permanecem bloqueios externos.**
