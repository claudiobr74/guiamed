---
name: firebase-feature
description: Adiciona ou altera dados Firebase no GuiaMed com validação, tenancy e Security Rules juntos.
---

# Firebase feature

Projeto `guiamed-918ee`. Admin SDK no servidor.

Checklist:
- Coleção sob `organizations/{orgId}/...` ou documento com `organizationId`.
- Validar payload no servidor (zod ou parsers de domínio).
- Atualizar `firestore.rules` / `storage.rules` na mesma mudança.
- Não expor dados de outra organização.
- Storage privado; path inclui `organizationId`.
- Sem secrets no cliente além de `NEXT_PUBLIC_FIREBASE_*` (apiKey, projectId, bucket).

Depois, skill `firebase-security-review` e agente `firebase-security-auditor`. Achados Critical/High bloqueiam conclusão.
