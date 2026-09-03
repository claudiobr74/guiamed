"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchProceduresAction } from "@/app/actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { saveKitDetailedAction } from "@/features/kits/actions";
import type { Procedure, ProcedureKit } from "@/types/domain";

type DraftItem = {
  rowId: string;
  procedureId: string;
  procedureName: string;
  defaultCodeId: string;
  defaultQuantity: string;
  notes: string;
};

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

function draftItems(kit: ProcedureKit | null): DraftItem[] {
  if (!kit) return [];
  return kit.items.map((item) => ({
    rowId: item.id || crypto.randomUUID(),
    procedureId: item.procedureId,
    procedureName: item.procedureName,
    defaultCodeId: item.defaultCodeId ?? "",
    defaultQuantity: String(item.defaultQuantity || 1),
    notes: item.notes ?? "",
  }));
}

export function KitEditor({
  kit,
  initialProcedures,
}: {
  kit: ProcedureKit | null;
  initialProcedures: Procedure[];
}) {
  const router = useRouter();
  const [name, setName] = useState(kit?.name ?? "");
  const [description, setDescription] = useState(kit?.description ?? "");
  const [specialty, setSpecialty] = useState(kit?.specialty ?? "");
  const [items, setItems] = useState<DraftItem[]>(() => draftItems(kit));
  const [knownProcedures, setKnownProcedures] = useState<Procedure[]>(initialProcedures);
  const [procedureQuery, setProcedureQuery] = useState("");
  const [procedureResults, setProcedureResults] = useState<Procedure[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const procedureById = useMemo(
    () => new Map(knownProcedures.map((procedure) => [procedure.id, procedure])),
    [knownProcedures],
  );

  useEffect(() => {
    const query = procedureQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setSearching(true);
      void searchProceduresAction(query)
        .then((results) => {
          if (!cancelled) setProcedureResults(results.filter((procedure) => procedure.active));
        })
        .catch(() => {
          if (!cancelled) setProcedureResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [procedureQuery]);

  function patchItem(rowId: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item)));
  }

  function addProcedure(procedure: Procedure) {
    setMessage(null);
    if (items.some((item) => item.procedureId === procedure.id)) {
      setMessage(`${procedure.name} já está neste kit.`);
      return;
    }
    setKnownProcedures((current) =>
      current.some((candidate) => candidate.id === procedure.id) ? current : [...current, procedure],
    );
    setItems((current) => [
      ...current,
      {
        rowId: crypto.randomUUID(),
        procedureId: procedure.id,
        procedureName: procedure.name,
        defaultCodeId: "",
        defaultQuantity: "1",
        notes: "",
      },
    ]);
    setProcedureQuery("");
    setProcedureResults([]);
    setSearching(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nome do kit">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Artrodese cervical" />
        </Field>
        <Field label="Especialidade">
          <Input value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Neurocirurgia" />
        </Field>
      </div>

      <Field label="Descrição">
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-[70px]" />
      </Field>

      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <div className="mb-3">
          <p className="text-[13px] font-bold text-[#0f172a]">Adicionar procedimento</p>
          <p className="mt-1 text-[11px] text-[#64748b]">
            Pesquise por nome ou código. O catálogo completo não é carregado na abertura do editor.
          </p>
        </div>
        <Field label="Buscar procedimento">
          <Input
            value={procedureQuery}
            onChange={(event) => {
              const next = event.target.value;
              setProcedureQuery(next);
              if (next.trim().length < MIN_SEARCH_LENGTH) {
                setProcedureResults([]);
                setSearching(false);
              }
            }}
            placeholder="Digite ao menos 2 caracteres"
          />
        </Field>
        {searching ? <p className="mt-2 text-[11px] text-[#64748b]">Buscando...</p> : null}
        {procedureResults.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {procedureResults.map((procedure) => (
              <button
                key={procedure.id}
                type="button"
                onClick={() => addProcedure(procedure)}
                className="rounded-lg border border-[#dbe3ee] bg-white px-3 py-2 text-left hover:border-[#93b4da] hover:bg-[#eff6ff]"
              >
                <span className="block text-[12px] font-semibold text-[#0f172a]">{procedure.name}</span>
                <span className="mt-1 block text-[10px] text-[#64748b]">
                  {procedure.codes.length > 0
                    ? `${procedure.codes.length} código(s) vinculado(s)`
                    : "sem código vinculado"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#e2e8f0]">
        <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
          <p className="text-[13px] font-bold text-[#0f172a]">Itens do kit</p>
          <p className="text-[11px] text-[#64748b]">Defina o código de referência opcional e a quantidade padrão de cada procedimento.</p>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-[#64748b]">Pesquise e adicione ao menos um procedimento.</p>
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {items.map((item, index) => {
              const procedure = procedureById.get(item.procedureId);
              const codes = procedure?.codes.filter((code) => code.active) ?? [];
              const unavailablePreferredCode = item.defaultCodeId && !codes.some((code) => code.id === item.defaultCodeId);
              return (
                <div key={item.rowId} className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-[minmax(240px,1.1fr)_minmax(300px,1.4fr)_110px_1fr_90px]">
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-[#475569]">Procedimento {index + 1}</p>
                    <div className="min-h-10 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#0f172a]">
                      {procedure?.name ?? item.procedureName}
                      {!procedure ? <span className="ml-2 text-[10px] font-normal text-[#b45309]">indisponível/inativo</span> : null}
                    </div>
                  </div>

                  <Field label="Código de referência">
                    <Select
                      value={item.defaultCodeId}
                      disabled={!procedure}
                      onChange={(event) => {
                        const codeId = event.target.value;
                        const code = codes.find((candidate) => candidate.id === codeId);
                        patchItem(item.rowId, {
                          defaultCodeId: codeId,
                          defaultQuantity: code ? String(code.defaultQuantity || 1) : item.defaultQuantity,
                        });
                      }}
                    >
                      <option value="">Automático conforme convênio/vigência</option>
                      {unavailablePreferredCode ? (
                        <option value={item.defaultCodeId}>Código anterior indisponível</option>
                      ) : null}
                      {codes.map((code) => (
                        <option key={code.id} value={code.id}>
                          {code.codeSystem} {code.code} — {code.description}{code.healthInsurerId ? " • específico" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Quantidade">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={item.defaultQuantity}
                      onChange={(event) => patchItem(item.rowId, { defaultQuantity: event.target.value })}
                    />
                  </Field>

                  <Field label="Observação">
                    <Input
                      value={item.notes}
                      onChange={(event) => patchItem(item.rowId, { notes: event.target.value })}
                      placeholder="Opcional"
                    />
                  </Field>

                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      className="w-full text-[#dc2626]"
                      type="button"
                      onClick={() => setItems((current) => current.filter((candidate) => candidate.rowId !== item.rowId))}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {message ? (
        <p className={`rounded-lg px-3 py-2 text-[12px] ${message === "Kit salvo." ? "bg-[#ecfdf5] text-[#166534]" : "bg-[#fef2f2] text-[#991b1b]"}`}>
          {message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              try {
                await saveKitDetailedAction({
                  id: kit?.id,
                  name,
                  description: description || undefined,
                  specialty: specialty || undefined,
                  items: items.map((item) => ({
                    procedureId: item.procedureId,
                    defaultCodeId: item.defaultCodeId || null,
                    defaultQuantity: Number(item.defaultQuantity),
                    notes: item.notes || undefined,
                  })),
                });
                setMessage("Kit salvo.");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Não foi possível salvar o kit.");
              }
            });
          }}
        >
          {pending ? "Salvando..." : kit ? "Salvar alterações" : "Criar kit"}
        </Button>
      </div>
    </div>
  );
}
