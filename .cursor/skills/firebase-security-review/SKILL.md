---
name: firebase-security-review
description: Revisa Auth, Firestore, Storage, tenancy e autorização do GuiaMed.
---

# Firebase security review

Procurar:
- Critical: secret padrão em produção; acesso cross-org; arquivo médico público; role só na UI.
- High: papel só no cookie; fallback local de PDF em produção; médico acessando rota admin.
- Medium: cookie inválido tratado como logado no middleware; seed CID sem marker.

Confirmar:
- Rules deny-by-default no cliente.
- `getCurrentUser` revalida `users/{uid}` no Firestore.
- Rotas admin usam `requirePageAdmin` / `requireAdmin`.
- Download de arquivo exige sessão e `organizationId` no path.
