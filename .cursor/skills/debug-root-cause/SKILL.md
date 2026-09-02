---
name: debug-root-cause
description: Depura falhas do GuiaMed pela causa raiz, sem patch cego.
---

# Debug root cause

1. Reproduzir com evidência (log, teste, resposta HTTP, tela).
2. Isolar camada: UI, Server Action, Auth/sessão, Firestore, Storage, PDF.
3. Corrigir a causa. Não silenciar erro médico (código ausente, overflow, quantidade inválida).
4. Adicionar ou ajustar teste quando o bug for de domínio.
5. Reexecutar os gates.
