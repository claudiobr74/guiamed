# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-03

## Estado atual

- Base auditada: `origin/cursor/guiamed-app-e951` em `2c14a3d`.
- Branch de trabalho: `fix/core-clinical-workflow`.
- Último head funcional validado: `e8824e0921fdc496f8265d2dadfb2f8a6ea6f690`.
- GitHub Actions CI #69: **SUCCESS** — lint PASS, typecheck PASS, Vitest **114/114 PASS**, build Next.js 16.3.4/Turbopack PASS.
- Vercel do mesmo head: **SUCCESS**.
- E2E autenticado: workflow #52 executou a checagem de configuração, mas `browser-flow` ficou **SKIPPED** porque os seis secrets `E2E_*` ainda não estão configurados. Não considerar E2E PASS.
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
- cancelamento exige motivo e gera auditoria sem apagar o PDF histórico.

### Pacientes, médicos e organização

- lista de pacientes paginada server-side em lotes de até 50, com convênios hidratados em lote e CPF mascarado;
- cadastro e edição completa de paciente: nome, nascimento, sexo, CPF validado, telefone, e-mail, carteirinha e convênio;
- edição do paciente não altera snapshots de guias finalizadas;
- validação/normalização runtime com Zod para paciente, médico, instituição, convênio e procedimento;
- assinatura médica por PNG/JPEG no Storage privado, com limite, MIME/assinatura binária, dimensões, rate limit, preview, substituição/remoção e auditoria;
- salvar perfil do médico preserva assinatura já existente;
- Configurações agora permitem editar nome da organização, CNPJ, telefone, e-mail e endereço, com validação e audit log.

### Administração

- instituições e convênios podem ser criados, editados e ativados/desativados;
- procedimentos canônicos podem ser editados com nome, descrição, especialidade, categoria, sinônimos e status;
- visualização administrativa mostra códigos/versionamento ligados ao procedimento;
- editor real de kits, com procedimento explícito, código de referência, quantidade e observações;
- gerenciador de vínculos TUSS/IPASGO com operadora específica ou código geral e quantidade padrão;
- importação TUSS/IPASGO em chunks, preview de conflitos/duplicados/inválidos, CSV/XLSX/JSON e indexação;
- catálogo TUSS/IPASGO administrativo paginado server-side.

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
- caracteres fora de WinAnsi ainda são bloqueados com erro explícito para não corromper o conteúdo.

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

1. Embutir uma fonte Unicode licenciada com `@pdf-lib/fontkit`, mantendo validação explícita para glifos realmente ausentes.
2. Criar fixtures de PDFs representativos/anonimizados e validar overlay, AcroForm, assinatura e continuação multipágina.
3. Expandir paginação server-side para procedimentos canônicos, kits, templates, médicos e instituições e remover scans restantes ao abrir o editor da guia.
4. Configurar os seis secrets do Firebase de teste e obter o primeiro `browser-flow` realmente executado.

## Pendências

### P0 externo

- configurar `E2E_FIREBASE_SERVICE_ACCOUNT`, `E2E_FIREBASE_API_KEY`, `E2E_FIRESTORE_DATABASE_ID`, `E2E_FIREBASE_STORAGE_BUCKET`, `E2E_USER_EMAIL` e `E2E_USER_PASSWORD` para executar o navegador autenticado de verdade.

### P1

- fonte Unicode embarcada;
- fixtures de PDFs representativos e inspeção visual sistemática;
- paginação dos catálogos administrativos restantes;
- reduzir scans restantes de templates/kits/relatórios;
- expandir audit logs para todas as mutações administrativas relevantes;
- confirmar em PDFs oficiais reais regras específicas de valores de checkbox/radio/dropdown;
- revisar política de overflow por template oficial.

### P2

- hardening adicional de headers/CSP;
- auditoria de acessibilidade e responsividade nas resoluções-alvo;
- comparação sistemática com Figma;
- README operacional final;
- migração `middleware` → `proxy` após validação específica no Next.js 16.

## Commits recentes desta rodada

- `ab0cafc` — revisão final real, read-only e cancelamento auditável;
- `5f3b9d7` — correção React 19 do modal de revisão;
- `c627882` — hardening do Template Studio/upload;
- `14dfeab` — correção da rotulagem da justificativa determinística;
- `871837e` — E2E expandido para o fluxo clínico completo;
- `4129a1e` — assinatura médica privada;
- `789e3ee` — warnings CID informativos;
- `491b166` — validação/normalização administrativa e preservação da assinatura;
- `7eece29` — edição administrativa de instituições/convênios/procedimentos;
- `cee3e85` / `e8824e0` — Configurações editáveis e edição completa de pacientes + correção de typecheck.
