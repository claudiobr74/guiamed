# GuiaMed

Aplicação web para auxiliar médicos no preenchimento de guias de solicitação de cirurgias e procedimentos a partir do PDF oficial da instituição/operadora.

O GuiaMed organiza paciente, médico, instituição, convênio, CID-10, procedimentos, códigos TUSS/IPASGO, quantidades e justificativa clínica, aplica esses dados ao template PDF configurado e preserva uma versão histórica imutável após a finalização.

O sistema **não substitui julgamento médico**, não cria indicação clínica e não deve inventar CID, TUSS ou IPASGO. A finalização exige revisão médica explícita dos dados, códigos e quantidades.

## Stack

- Next.js 16.3.4 (App Router) + React 19 + TypeScript + Tailwind 4
- Firebase Authentication, Cloud Firestore e Firebase Storage
- Firebase Admin SDK somente no servidor
- Vercel para deploy web
- GitHub Actions para lint, typecheck, testes, fixtures PDF e build
- `pdf-lib` + `@pdf-lib/fontkit` para geração/preenchimento
- PDF.js para o Template Studio
- Vitest para testes automatizados

## Arquitetura e isolamento

Dados organizacionais ficam sob `organizations/{organizationId}/...`. O `organizationId` é derivado da sessão autenticada; o cliente não escolhe livremente o tenant.

Firestore e Storage negam acesso direto do browser. O aplicativo usa o Admin SDK no servidor e todas as páginas, Route Handlers e Server Actions sensíveis revalidam sessão e organização. O Proxy do Next.js serve apenas como barreira antecipada de navegação e não substitui a autorização server-side.

Arquivos médicos permanecem privados. PDFs finalizados e templates são lidos por rota autenticada, com validação de sessão, tenant, bucket e vínculo do arquivo.

## Fluxo clínico principal

Login → Paciente → Instituição/convênio → Template → Diagnóstico/CID-10 → Procedimentos → TUSS/IPASGO → Quantidades → Justificativa → Revisão médica → PDF definitivo → Histórico.

Pontos importantes:

- quantidade padrão é 1, mas códigos e kits podem sugerir valores maiores;
- a quantidade permanece editável antes da finalização;
- TUSS e IPASGO são resolvidos por procedimento, sistema, vigência, versão e convênio;
- snapshots de código, descrição e versão são preservados na guia;
- autosave usa revisão monotônica para evitar sobrescrita fora de ordem;
- template incompatível com instituição/convênio é rejeitado;
- guia finalizada fica read-only;
- alterações posteriores exigem duplicação para uma nova versão;
- cancelamento de guia finalizada exige motivo e gera auditoria.

## Cadastro e tabelas

Não use tabelas TUSS/IPASGO inventadas ou dados clínicos fictícios em produção.

A tela **Tabelas** aceita CSV, XLSX e JSON com preview antes da importação. Importações são idempotentes por sistema/código/versão e preservam vínculos administrativos existentes.

O catálogo CID-10 é tratado separadamente e possui busca própria.

## Templates PDF

Administradores podem enviar o PDF original da instituição/operadora e configurá-lo no Template Studio.

O upload valida antes de persistir:

- extensão/tipo PDF;
- tamanho máximo;
- assinatura `%PDF`;
- estrutura carregável;
- número de páginas;
- dimensões válidas;
- rate limit de upload.

O Template Studio suporta:

- overlay visual por página;
- AcroForm;
- campos obrigatórios;
- fonte/tamanho/alinhamento;
- multiline e auto-shrink;
- limite de caracteres;
- repeaters de procedimentos;
- múltiplas páginas;
- criação, movimento e redimensionamento por ponteiro;
- criação e ajuste por teclado;
- confirmação administrativa de sugestões AcroForm.

A geração usa Liberation Sans embarcada com `@pdf-lib/fontkit`, permitindo Unicode real. Se um glifo realmente não existir, a geração falha explicitamente em vez de substituir silenciosamente o conteúdo.

Overflow horizontal, vertical, de caracteres ou de número de procedimentos bloqueia a geração; o sistema não deve truncar conteúdo clínico silenciosamente.

## Finalização e histórico

A geração definitiva é executada novamente no servidor a partir da revisão persistida.

A finalização registra de forma transacional:

- usuário responsável;
- timestamp;
- revisão da guia;
- declaração de revisão médica;
- versão exata do template;
- hash do template/PDF;
- snapshot histórico de paciente, médico, instituição, convênio, CID, procedimentos, códigos e quantidades;
- documento final armazenado.

O histórico deve permanecer independente de alterações futuras nos cadastros vivos.

## Auditoria

Os audit logs administrativos cobrem, entre outros:

- importação de tabelas;
- alteração de vínculos TUSS/IPASGO;
- procedimentos;
- kits;
- instituições;
- convênios/operadoras;
- médicos e médico padrão;
- assinatura médica;
- templates e novas versões;
- mappings e repeaters do Template Studio;
- configurações da organização;
- finalização, geração e cancelamento de guias.

Evite gravar PHI desnecessária em metadata de auditoria ou logs de aplicação.

## Desenvolvimento local

Pré-requisitos:

- Node.js 20+
- pnpm 10.33.3
- projeto Firebase configurado

Instalação:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abra `http://localhost:3000`.

### Variáveis principais

Consulte `.env.example`. Em produção, são obrigatórios ao menos:

- `SESSION_SECRET`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `FIRESTORE_DATABASE_ID`
- credencial Firebase Admin via `FIREBASE_SERVICE_ACCOUNT` ou `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

Nunca commite service accounts, chaves privadas ou credenciais de usuário.

## Firebase

Publicação das regras:

```bash
firebase deploy --only firestore:rules,storage
```

As regras atuais negam leitura/escrita direta do cliente. Se isso for alterado no futuro, a mudança deve passar por revisão específica de segurança e tenancy.

## Busca e reindexação

Pacientes, procedimentos e códigos possuem índice de busca normalizado para evitar scans completos em uso normal.

Organizações antigas que ainda não possuam a versão atual do índice podem ser reindexadas pela manutenção disponível em **Configurações**. O processo é executado em chunks e deve ser concluído antes de considerar o índice pronto.

## Testes e CI

Comandos locais:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

O CI do PR executa essa sequência e publica fixtures PDF sintéticas como artifact.

As fixtures cobrem:

1. overlay Unicode;
2. controles AcroForm;
3. assinatura sintética;
4. repeater multipágina.

Nenhuma fixture deve conter dados reais de paciente.

## E2E autenticado

O workflow `.github/workflows/e2e.yml` exige seis secrets:

- `E2E_FIREBASE_SERVICE_ACCOUNT`
- `E2E_FIREBASE_API_KEY`
- `E2E_FIRESTORE_DATABASE_ID`
- `E2E_FIREBASE_STORAGE_BUCKET`
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

Sem esses secrets, o job `configuration` pode concluir com sucesso, mas `browser-flow` fica **SKIPPED**. Isso **não** deve ser registrado como E2E PASS.

Quando configurado, o fluxo cobre autenticação real e o caminho clínico principal até PDF finalizado, acesso autenticado ao arquivo, bloqueio sem sessão, duplicação e imutabilidade do original.

Use projeto/tenant de teste isolado; nunca aponte o seed E2E para dados clínicos de produção.

## Vercel

O deploy de preview é acionado pela integração GitHub/Vercel. Um status `build-rate-limit` significa bloqueio de cota do plano e não deve ser confundido com falha de compilação.

Antes de promover uma versão:

1. CI verde;
2. E2E autenticado real verde quando os secrets estiverem disponíveis;
3. preview Vercel construído;
4. inspeção manual do fluxo principal;
5. validação de pelo menos um template oficial/anonimizado autorizado quando houver mudança no motor PDF.

## Fluxo Git

O desenvolvimento desta fase ocorre em `fix/core-clinical-workflow`, com PR #2 contra `cursor/guiamed-app-e951`.

Não alterar `main` enquanto essa linha de correção não estiver explicitamente pronta para integração.

## Pendências externas para fechamento do MVP

- configurar os seis secrets E2E e obter o primeiro `browser-flow` autenticado real;
- validar checkbox/radio/dropdown e política de overflow em PDFs oficiais reais/anonimizados autorizados;
- concluir comparação sistemática de fidelidade com o Figma e inspeção visual hospedada após liberação da cota Vercel.
