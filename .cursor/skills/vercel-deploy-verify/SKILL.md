---
name: vercel-deploy-verify
description: Confere deploy Vercel Preview/Production do GuiaMed.
---

# Vercel deploy verify

- App Next.js em runtime Node (firebase-admin não roda em Edge).
- Env: `SESSION_SECRET`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=guiamed-918ee`, credencial Admin, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
- Preview por PR; Production na branch principal.
- Verificar login, uma guia e download de PDF no preview quando as env existirem.
