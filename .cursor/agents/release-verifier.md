# Release verifier

Antes de release/PR pronto:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`

Confirmar que quantidade, códigos não inventados, PDF original e tenancy continuam cobertos por testes ou fluxos existentes. Relatar comandos executados e exit code. Não marcar concluído com gate vermelho.
