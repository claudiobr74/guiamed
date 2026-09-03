# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-03

## Estado atual

- Base auditada: `origin/cursor/guiamed-app-e951` em `2c14a3d`.
- Branch de trabalho: `fix/core-clinical-workflow`.
- Último head funcional validado: `274773c1f593a104eb5a9842515c23a5ec16edde`.
- GitHub Actions CI #97: **SUCCESS** — install PASS, lint PASS, typecheck PASS, Vitest **119/119 PASS em 26 arquivos**, build Next.js 16.3.4/Turbopack PASS.
- O CI também publica o artifact `pdf-fixtures-2` com quatro PDFs 100% sintéticos e `manifest.json`; o artifact do CI #97 foi inspecionado visualmente após renderização a 160 dpi.
- Vercel do head atual não chegou a executar o build por **build-rate-limit da conta**. O build equivalente no GitHub Actions está PASS; não tratar o status Vercel atual como regressão de código. O checkpoint anterior de Kits (`b5d6dbd`) teve Vercel SUCCESS.
- E2E autenticado #80: configuração PASS, mas `browser-flow` **SKIPPED** porque os seis secrets `E2E_*` ainda não estão configurados. Não considerar E2E PASS.
- `main` permanece intocado; PR #2 continua aberto contra `cursor/guiamed-app-e951`.

## Concluído no fluxo crítico

### Guia clínica e finalização

- resolvedor determinístico TUSS/IPASGO por procedimento, sistema, vigência, versão e convênio;
- quantidade padrão por código e por kit, sempre editável e podendo ser >1;
- materialização server-side dos itens e rejeição de snapshots/códigos adulterados;
- CID-10 oficial com normalização do snapshot, busca e warnings informativos de restrição/exclusão;
- autosave serializado por revisão monotônica, sem sobrescrita por resposta atrasada;
- template compatível com instituição/convênio e invalidação automática quando o contexto muda;
- checklist final ligado à validação server-side real;
- finalização transacional com confirmação médica, usuário, timestamp, revisão, hash e snapshot histórico;
- guia finalizada em modo realmente somente leitura;
- duplicação cria nova guia editável sem alterar o original;
- cancelamento exige motivo e gera auditoria sem apagar o PDF histórico;
- abertura/preview/renderização de uma guia hidratam paciente, médico, instituição e convênio diretamente pelos IDs, sem scans de coleções;
- guia finalizada não carrega catálogos administrativos que não podem ser editados.

### Pacientes, médicos e organização

- lista de pacientes paginada server-side em lotes de até 50, com convênios hidratados em lote e CPF mascarado;
- cadastro e edição completa de paciente: nome, nascimento, sexo, CPF validado, telefone, e-mail, carteirinha e convênio;
- edição do paciente não altera snapshots de guias finalizadas;
- validação/normalização runtime com Zod para paciente, médico, instituição, convênio e procedimento;
- assinatura médica por PNG/JPEG no Storage privado, com limite, MIME/assinatura binária, dimensões, rate limit, preview, substituição/remoção e auditoria;
- salvar perfil do médico preserva assinatura já existente;
- Configurações permitem editar nome da organização, CNPJ, telefone, e-mail e endereço, com validação e audit log.

### Administração e performance Firestore

- instituições e convênios podem ser criados, editados e ativados/desativados;
- médicos paginados server-side em lotes de 50, em ordem alfabética;
- instituições e convênios paginados independentemente, 50 por página, sem `offset`;
- procedimentos canônicos paginados server-side em lotes de 50; códigos são lidos somente para os procedimentos visíveis;
- procedimentos canônicos podem ser editados com nome, descrição, especialidade, categoria, sinônimos e status;
- gerenciador de vínculos TUSS/IPASGO não carrega mais todos os procedimentos/convênios: relações atuais são hidratadas por ID e novas escolhas são pesquisadas sob demanda;
- vínculo direto no servidor rejeita procedimento ou operadora inativos, mesmo que a UI seja contornada;
- kits paginados em lotes de 20; somente procedimentos referenciados pelos kits visíveis/selecionados são carregados;
- editor de kits pesquisa novos procedimentos sob demanda, preservando código de referência, quantidade padrão editável e observações;
- templates paginados em lotes de 20; versões históricas são consultadas apenas para os templates visíveis;
- formulário de upload de template busca instituição/operadora sob demanda, sem scans globais na abertura;
- importação TUSS/IPASGO em chunks, preview de conflitos/duplicados/inválidos, CSV/XLSX/JSON e indexação;
- catálogo TUSS/IPASGO administrativo paginado server-side;
- lista `/guias` usa paginação por cursor, leitura em lotes e hidratação em batch das referências, evitando N+1 por solicitação.

### PDF / Template Studio

- upload de PDF com validação antes de `arrayBuffer`, assinatura PDF, tamanho, páginas, estrutura e rate limit;
- Storage privado e leitura por rota autenticada com sessão, tenant e vínculo;
- PDF.js com worker local e Pointer Events para mouse, toque e caneta;
- mappings editáveis com posição, tamanho, página, fonte, alinhamento, multiline, auto-shrink, required e maxCharacters;
- repeaters editáveis com página, linhas, altura e colunas de procedimento/TUSS/IPASGO/quantidade/lateralidade/observações;
- validação Zod server-side de mappings e repeaters;
- métricas reais de texto, wrap e auto-shrink sem truncamento silencioso;
- overflow horizontal/vertical/maxCharacters bloqueia geração explicitamente;
- múltiplos repeaters funcionam como continuação sequencial;
- AcroForm tipado para TextField, checkbox, radio, dropdown e option list, sem fallback silencioso;
- `@pdf-lib/fontkit` + Liberation Sans embarcada permitem Unicode real em overlay e AcroForm;
- caracteres realmente ausentes da fonte continuam bloqueados explicitamente, sem transliteração ou `.notdef` silencioso;
- testes Unicode cobrem acentos, apóstrofo tipográfico, travessão e símbolo `≥`.

### Fixtures PDF sintéticas e inspeção visual

O CI gera e publica quatro fixtures sem qualquer dado real de paciente:

1. `01-overlay-unicode.pdf` — overlay Unicode, alinhamento, multiline e CID;
2. `02-acroform-controls.pdf` — TextField Unicode, checkbox, radio e dropdown;
3. `03-signature-image.pdf` — PNG de assinatura totalmente sintética dentro da área mapeada;
4. `04-multipage-repeaters.pdf` — 7 procedimentos, com 5 linhas na página 1 e 2 linhas na página 2.

Inspeção do artifact do CI #97 após renderização a 160 dpi: **sem clipping, sem sobreposição, sem quadrados/glifos quebrados; AcroForm visualmente correto; assinatura contida; continuação multipágina correta**.

### E2E implementado

`scripts/e2e-flow.cjs` cobre no código:

1. autenticação Firebase real;
2. criação de médico e paciente sintéticos;
3. nova guia;
4. instituição/convênio/template;
5. CID oficial;
6. busca manual de procedimento;
7. TUSS/IPASGO e quantidade;
8. justificativa;
9. preview temporário sem finalizar;
10. checklist e confirmação médica;
11. PDF final autenticado;
12. rejeição do mesmo PDF sem sessão;
13. read-only do original;
14. duplicação;
15. edição da cópia e verificação de que o original não mudou.

A infraestrutura está pronta, mas a evidência de navegador ainda depende dos secrets externos.

## Próxima tarefa exata

1. Auditar as mutações administrativas restantes e garantir audit log consistente onde ainda faltar, começando por vínculo TUSS/IPASGO e importações.
2. Validar com templates oficiais reais/anonimizados os valores de exportação específicos de checkbox/radio/dropdown e a política de overflow por formulário.
3. Configurar os seis secrets do Firebase de teste e obter o primeiro `browser-flow` realmente executado.
4. Depois: hardening de headers/CSP, acessibilidade/responsividade, comparação sistemática com Figma e migração `middleware` → `proxy` com teste dedicado.

## Pendências

### P0 externo

- configurar `E2E_FIREBASE_SERVICE_ACCOUNT`, `E2E_FIREBASE_API_KEY`, `E2E_FIRESTORE_DATABASE_ID`, `E2E_FIREBASE_STORAGE_BUCKET`, `E2E_USER_EMAIL` e `E2E_USER_PASSWORD` para executar o navegador autenticado de verdade;
- aguardar a liberação/cota de builds Vercel para validar o head atual também no preview hospedado.

### P1

- expandir/confirmar audit logs de todas as mutações administrativas relevantes;
- confirmar em PDFs oficiais reais regras específicas de valores de checkbox/radio/dropdown;
- revisar política de overflow por template oficial;
- incorporar templates oficiais anonimizados ao conjunto de regressão apenas quando houver autorização e remoção garantida de dados sensíveis.

### P2

- hardening adicional de headers/CSP;
- auditoria de acessibilidade e responsividade nas resoluções-alvo;
- comparação sistemática com Figma;
- README operacional final;
- migração `middleware` → `proxy` após validação específica no Next.js 16.

## Commits recentes desta rodada

- `d1216d0` — fonte Unicode embarcada com `fontkit` e validação explícita de glifos;
- `612c735` — hidratação direta de referências da guia e remoção de scans em modo finalizado;
- `fd9c283` — paginação de médicos, instituições e convênios;
- `b5d6dbd` — Kits paginados + busca de procedimentos sob demanda; CI/Vercel PASS;
- `58300b1` — Templates paginados + associações buscadas sob demanda;
- `bb8d2f7` — procedimentos canônicos/vínculos paginados e relacionamentos sob demanda; CI #94 PASS;
- `e0707aa` — rejeição server-side de vínculos com registros inativos;
- `ab117a7` — quatro fixtures PDF sintéticas representativas;
- `274773c` — CI publica as fixtures como artifact para inspeção visual; CI #97 PASS, 119/119 testes.
