"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { setRequestTussTableAction } from "@/features/requests/tuss-table-actions";
import type { TussCodeTable } from "@/types/domain";

export function RequestTussTablePicker({
  requestId,
  selectedKey,
  tables,
}: {
  requestId: string;
  selectedKey: string | null | undefined;
  tables: TussCodeTable[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (tables.length === 0) {
    return (
      <section className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#92400e]">Nenhuma Tabela TUSS cadastrada.</p>
        <p className="mt-1 text-[11px] text-[#78350f]">
          Importe uma tabela antes de adicionar procedimentos à guia.
        </p>
        <Link href="/tabelas" className="mt-2 inline-block text-[12px] font-semibold text-[#1e5fa6] hover:underline">
          Ir para Tabelas TUSS
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(260px,420px)_1fr] md:items-end">
        <div>
          <label htmlFor="request-tuss-table" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#475569]">
            Tabela TUSS desta guia
          </label>
          <Select
            id="request-tuss-table"
            value={selectedKey ?? ""}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value || null;
              setError(null);
              startTransition(async () => {
                try {
                  await setRequestTussTableAction(requestId, next);
                  router.refresh();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Não foi possível alterar a Tabela TUSS.");
                }
              });
            }}
          >
            <option value="">Selecione a tabela</option>
            {tables.map((table) => (
              <option key={table.key} value={table.key}>
                {table.name}{table.currentVersion ? ` — ${table.currentVersion}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="text-[11px] leading-5 text-[#64748b]">
            A escolha é manual. Todos os códigos dos procedimentos desta solicitação serão resolvidos exclusivamente dentro da tabela selecionada.
          </p>
          {pending ? <p role="status" className="mt-1 text-[11px] font-semibold text-[#1e5fa6]">Atualizando tabela e códigos...</p> : null}
          {error ? <p role="alert" className="mt-1 text-[11px] font-semibold text-[#b91c1c]">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
