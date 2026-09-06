# LizaCare

Aplicativo web simples para preenchimento de guias de solicitação de cirurgias e procedimentos médicos.

## Fluxo principal

Paciente → operadora → template PDF → CID-10 → procedimentos → quantidade → indicação/justificativa → PDF preenchido.

## Stack

- React + Vite + TypeScript
- Firebase Authentication + Firestore
- PDF.js / pdf-lib
- Gemini apenas como auxílio opcional para detectar campos de templates

## Princípio do projeto

O LizaCare prioriza simplicidade. Novas camadas, serviços e abstrações só devem ser adicionados quando resolverem uma necessidade real do produto.

## Rodar localmente

1. `npm install`
2. copie `.env.example` para `.env.local`
3. configure `GEMINI_API_KEY` apenas se quiser usar a detecção de campos por IA
4. `npm run dev`

A configuração pública do Firebase usada pelo cliente está em `firebase-applet-config.json`.

## Dados

- pacientes, operadoras, tabelas, procedimentos, kits, templates e solicitações ficam no Firestore;
- cada registro clínico/administrativo é isolado por `doctorId` nas regras do Firestore;
- o CID-10 oficial é carregado localmente em `public/data/cid10.json` e indexado no navegador;
- PDFs de templates são armazenados no Firestore em chunks, sem depender do Firebase Storage.

## Deploy

O frontend é um SPA Vite. Em Vercel, a rota `/api/detect-fields` é uma função serverless opcional e as demais rotas são reescritas para `index.html`.
