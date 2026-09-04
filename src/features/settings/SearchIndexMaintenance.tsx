"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { rebuildSearchIndexChunkAction } from "@/features/settings/search-index-actions";
import type { SearchIndexStatus } from "@/lib/db/indexed-search";

const COLLECTION_LABELS: Record<string, string> = {
  patients: "pacientes",
  procedures: "procedimentos",
  procedureCodes: "códigos TUSS/IPASGO",
  done: "concluído",
};

export function SearchIndexMaintenance({ initialStatus }: { initialStatus: SearchIndexStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rebuild() {
    setRunning(true);
    setError(null);
    try {
      let next = status;
      // Cada chamada processa no máximo 350 documentos. O cliente encadeia
      // chamadas curtas para não depender de uma função serverless longa.
      for (let chunk = 0; chunk < 100 && !next.ready; chunk += 1) {
        next = await rebuildSearchIndexChunkAction();
        setStatus(next);
      }
      if (!next.ready) {
        setError("A reindexação avançou 100 lotes e ainda não terminou. Clique novamente para continuar.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reindexar as buscas.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#0f172a]">Índice de busca clínica</p>
          <p className="mt-1 text-[12px] text-[#475569]">
            {status.ready
              ? "Pronto. Pacientes e procedimentos usam busca indexada no Firestore."
              : `Pendente${status.collection ? ` • processando ${COLLECTION_LABELS[status.collection] ?? status.collection}` : ""}.`}
          </p>
        </div>
        <Button type="button" onClick={() => void rebuild()} disabled={running || status.ready}>
          {status.ready ? "Índice atualizado" : running ? "Reindexando..." : "Reindexar agora"}
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[#475569]">
        <div className="rounded bg-white px-2 py-1.5">Pacientes: <strong>{status.processed.patients}</strong></div>
        <div className="rounded bg-white px-2 py-1.5">Procedimentos: <strong>{status.processed.procedures}</strong></div>
        <div className="rounded bg-white px-2 py-1.5">Códigos: <strong>{status.processed.procedureCodes}</strong></div>
      </div>
      {status.indexedAt ? (
        <p className="mt-2 text-[11px] text-[#64748b]">Última conclusão: {new Date(status.indexedAt).toLocaleString("pt-BR")}</p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-[#dc2626]">{error}</p> : null}
    </div>
  );
}
