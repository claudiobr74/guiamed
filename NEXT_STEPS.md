# GuiaMed — continuidade objetiva

Atualizado em: 2026-09-02

## Estado

- Base auditada: `origin/cursor/guiamed-app-e951` em `2c14a3d`.
- Branch de trabalho: `fix/core-clinical-workflow`.
- Head funcional validado: `38ce052` (`fix: harden PDF mapper loading and pointer input`).
- CI do head: lint PASS; typecheck PASS; testes PASS; build PASS.
- Deploy Vercel do head: SUCCESS.

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
- quantidade padrão editável por código.

### Kits

- editor administrativo real de kits;
- criação e edição de kits existentes;
- seleção explícita de procedimento;
- seleção de código de referência por item ou resolução automática;
- quantidade padrão por item, iniciando em 1 e podendo ser >1;
- seleção de código sugere a quantidade padrão configurada nesse código;
- servidor rejeita procedimento inexistente/inativo, duplicação do mesmo procedimento e código que não pertença ao procedimento.

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
- teste integrado rejeita tentativa de forçar código específico de outro convênio.

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

## Próxima tarefa exata

Fechar a validação E2E autenticada em ambiente controlado sem criar bypass de autenticação em produção. Depois, atacar escalabilidade de busca/paginação e debounce das buscas clínicas/administrativas.

## Pendências

### P0

- E2E de navegador autenticado do fluxo completo: login → paciente → CID → procedimentos/kit → justificativa → preview → finalização/PDF.

### P1

- estratégia de fonte Unicode embarcada para caracteres fora de WinAnsi sem corromper dados clínicos;
- ampliar suporte AcroForm além de text fields quando o formulário real exigir checkbox/radio/dropdown;
- paginação server-side e busca indexada para catálogos grandes;
- debounce/cancelamento de buscas de paciente, CID e procedimentos;
- upload robusto com limites explícitos, hash verificado e rate limiting;
- validar política de overflow por template para casos com mais procedimentos que a capacidade do formulário.

### P2

- refinamentos responsivos e acessibilidade após estabilização do fluxo crítico;
- migração do `middleware` para `proxy` após validar comportamento no Next.js 16.

## Commits desta rodada

- `3b80e34` — gerenciador de vínculos e preview detalhado de importação;
- `6e96dcc` — editor explícito de kits;
- `caa774e` — preview finalizado por rota autenticada;
- `3e27e58` — teste integrado do fluxo clínico;
- `d41f445` — métricas reais e alinhamento do PDF;
- `38ce052` — mapper autenticado, worker local e Pointer Events.
