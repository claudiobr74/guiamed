# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-02

## Estado

- Base auditada: `origin/cursor/guiamed-app-e951` em `2c14a3d`.
- Branch de trabalho: `fix/core-clinical-workflow`.
- Head funcional validado: `8668080` (`perf: avoid loading all patients and procedures on guide open`).
- CI do head: lint PASS; typecheck PASS; testes PASS; build PASS.
- Deploy Vercel do head: SUCCESS.
- E2E de navegador: infraestrutura pronta, mas `browser-flow` está explicitamente SKIPPED enquanto os secrets do Firebase de teste não estiverem configurados. Não considerar isso um E2E PASS.

## Concluído no fluxo crítico

### Catálogo TUSS / IPASGO

- schema backward-compatible de `ProcedureCode.defaultQuantity` e `healthInsurerId`;
- resolvedor determinístico por procedimento, sistema, vigência, versão e operadora;
- quantidade padrão do código aplicada na seleção manual;
- reimportação preserva vínculo, operadora e quantidade existentes e não confirma vínculo automaticamente;
- importação em chunks de 400 com progresso/status do batch;
- CSV com vírgula ou ponto e vírgula, fallback Windows-1252 e preservação de zeros à esquerda;
- preview separa conflitos com a base, duplicados no arquivo e linhas inválidas;
- conflitos exibem alteração de descrição, descontinuação ou reativação;
- duplicados/inválidos bloqueiam importação; conflitos exigem revisão mas não são tratados como erro estrutural;
- gerenciador administrativo de vínculos TUSS/IPASGO implementado;
- vínculo pode ser geral ou específico por convênio;
- quantidade padrão editável por código;
- tela administrativa de tabelas deixou de carregar o catálogo inteiro: paginação server-side por cursor com 100 códigos por página e leitura de no máximo 101 documentos por avanço.

### Kits

- editor administrativo real de kits;
- criação e edição de kits existentes;
- seleção explícita de procedimento;
- seleção de código de referência por item ou resolução automática;
- quantidade padrão por item, iniciando em 1 e podendo ser >1;
- seleção de código sugere a quantidade padrão configurada nesse código;
- servidor rejeita procedimento inexistente/inativo, duplicação do mesmo procedimento e código que não pertença ao procedimento;
- abertura da guia carrega apenas os procedimentos efetivamente referenciados pelos kits, em lotes, em vez de carregar todo `procedures` + `procedureCodes`.

### Guia clínica

- materialização server-side dos itens e rejeição de códigos adulterados/incompatíveis;
- kits resolvem TUSS/IPASGO na UI e são revalidados no servidor;
- teste obrigatório de kit com quantidades 1, 2 e 4;
- template filtrado/invalidationado por instituição e convênio;
- novo paciente propaga o convênio para a guia;
- autosave serializado com revisão monotônica e reenvio de alterações durante gravação;
- gravações atrasadas falham com `REQUEST_CHANGED` em vez de sobrescrever estado novo;
- confirmação médica validada no servidor e registrada com usuário, timestamp e revisão;
- snapshot histórico consolidado de paciente, médico, instituição, convênio, template, códigos, quantidades e CID;
- finalização compara revisão monotônica e `updatedAt`;
- teste integrado cobre entrada adulterada → catálogo confiável → código por convênio → CID/template → gate de finalização;
- teste integrado rejeita tentativa de forçar código específico de outro convênio;
- busca clínica de paciente, CID e procedimento usa debounce de 250 ms e mínimo de 2 caracteres;
- respostas assíncronas antigas são ignoradas, evitando resultado de busca fora de ordem;
- abrir a guia não carrega mais todos os pacientes: paciente já selecionado vem hidratado na solicitação e novas buscas são feitas sob demanda.

### Segurança de documentos

- criação de versão de template valida ownership e só desativa versões do mesmo tenant;
- falha após upload de template remove arquivo órfão;
- rota genérica de arquivos não expõe assinaturas e exige referência real a documento/template;
- preview de rascunho exige sessão e organização;
- PDF finalizado não usa mais URL pública do storage: passa por `/api/files/...`, que revalida sessão, tenant e vínculo;
- mapper de template também usa a rota autenticada, não a URL pública do storage.

### PDF / mapper

- largura de texto calculada pela métrica real da fonte, não por aproximação por caractere;
- auto-shrink baseado em largura real;
- quebra de linha baseada em métrica real e preservação de quebras explícitas;
- alinhamento `left`, `center` e `right` respeitado no overlay;
- texto que ainda excede o campo é limitado ao espaço disponível;
- fluxo AcroForm existente preservado;
- PDF.js não depende mais do worker hospedado no `unpkg`; worker é resolvido localmente pelo bundle;
- mapper usa Pointer Events e funciona com mouse, toque e caneta.

### E2E autenticado

- `scripts/e2e-seed.mjs` cria tenant Firebase isolado e determinístico, sem bypass de autenticação;
- seed cria usuário Firebase real, perfil, paciente, médico, convênio, instituição, procedimento, TUSS, IPASGO, kit e template PDF mínimo;
- `scripts/e2e-flow.cjs` percorre login → paciente → instituição/convênio → CID-10 → kit → quantidade → justificativa → revisão → confirmação médica → finalização → PDF;
- runner verifica que o PDF final responde 200 como `application/pdf` com sessão autenticada;
- runner verifica que a mesma rota retorna 401 sem sessão;
- workflow `.github/workflows/e2e.yml` usa um projeto Firebase de teste por secrets e não toca credenciais pessoais;
- quando os secrets não existem, `browser-flow` aparece como SKIPPED, não como falso PASS;
- execução manual sem secrets falha explicitamente.

## Próxima tarefa exata

1. Configurar os seis secrets do Firebase de teste e obter o primeiro E2E de navegador realmente executado: `E2E_FIREBASE_SERVICE_ACCOUNT`, `E2E_FIREBASE_API_KEY`, `E2E_FIRESTORE_DATABASE_ID`, `E2E_FIREBASE_STORAGE_BUCKET`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.
2. Substituir as buscas server-side que ainda fazem varredura de coleção por busca seletiva/indexada, especialmente `searchPatients` e `searchProcedures`.
3. Expandir paginação para telas administrativas/listas que ainda carregam coleções completas.

## Pendências

### P0

- executar e estabilizar o `browser-flow` E2E autenticado com os secrets de um Firebase de teste. A infraestrutura está pronta; falta o ambiente externo de teste.

### P1

- estratégia de fonte Unicode embarcada para caracteres fora de WinAnsi sem corromper dados clínicos;
- ampliar suporte AcroForm além de text fields quando o formulário real exigir checkbox/radio/dropdown;
- substituir busca de paciente/procedimento baseada em varredura por índices/campos normalizados, preservando compatibilidade com registros legados;
- expandir paginação server-side para telas que ainda carregam coleções completas;
- busca indexada para catálogos grandes;
- upload robusto com limites explícitos, hash verificado e rate limiting;
- validar política de overflow por template para casos com mais procedimentos que a capacidade do formulário.

### P2

- refinamentos responsivos e acessibilidade após estabilização do fluxo crítico;
- migração do `middleware` para `proxy` após validar comportamento no Next.js 16.

## Commits relevantes desta sequência

- `3b80e34` — gerenciador de vínculos e preview detalhado de importação;
- `6e96dcc` — editor explícito de kits;
- `caa774e` — preview finalizado por rota autenticada;
- `3e27e58` — teste integrado do fluxo clínico;
- `d41f445` — métricas reais e alinhamento do PDF;
- `38ce052` — mapper autenticado, worker local e Pointer Events;
- `f6fe8c5` — seed Firebase determinístico para E2E;
- `9203366` / `13f32a2` — runner do fluxo E2E autenticado e ajuste de lint;
- `121a79f` / `107d42d` — workflow E2E e status SKIPPED explícito quando não configurado;
- `71ee2c0` / `06c6f9a` — paginação server-side do catálogo TUSS/IPASGO;
- `cf15146` — debounce/cancelamento das buscas clínicas;
- `6dd4231` / `8668080` — carregamento seletivo de procedimentos dos kits e remoção do preload integral de pacientes/procedimentos ao abrir uma guia.
