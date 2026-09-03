"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { saveKitDetailedAction } from "@/features/kits/actions";
import type { Procedure, ProcedureKit } from "@/types/domain";

type DraftItem = {
  rowId: string;
  procedureId: string;
  defaultCodeId: string;
  defaultQuantity: string;
  notes: string;
};

function emptyItem(): DraftItem {
  return {
    rowId: crypto.randomUUID(),
    procedureId: "",
    defaultCodeId: "",
    defaultQuantity: "1",
    notes: "",
  };
}

export function KitEditor({
  kits,
  procedures,
}: {
  kits: ProcedureKit[];
  procedures: Procedure[];
}) {
  const router = useRouter();
  const [selectedKitId, setSelectedKitId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeProcedures = useMemo(() => procedures.filter((procedure) => procedure.active), [procedures]);

  function loadKit(id: string) {
    setSelectedKitId(id);
    setMessage(null);
    if (!id) {
      setName("");
      setDescription("");
      setSpecialty("");
      setItems([emptyItem()]);
      return;
    }
    const kit = kits.find((candidate) => candidate.id === id);
    if (!kit) return;
    setName(kit.name);
    setDescription(kit.description ?? "");
    setSpecialty(kit.specialty ?? "");
    setItems(
      kit.items.length > 0
        ? kit.items.map((item) => ({
            rowId: item.id || crypto.randomUUID(),
            procedureId: item.procedureId,
            defaultCodeId: item.defaultCodeId ?? "",
            defaultQuantity: String(item.defaultQuantity || 1),
            notes: item.notes ?? "",
          }))
        : [emptyItem()],
    );
  }

  function patchItem(rowId: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item)));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr_1fr]">
        <Field label="Editar kit existente">
          <Select value={selectedKitId} onChange={(event) => loadKit(event.target.value)}>
            <option value="">Novo kit</option>
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>{kit.name}</option>
            ))}
          </Select>
        </Field>
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

      <div className="rounded-xl border border-[#e2e8f0]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
          <div>
            <p className="text-[13px] font-bold text-[#0f172a]">Itens do kit</p>
            <p className="text-[11px] text-[#64748b]">Escolha o procedimento, um código de referência opcional e a quantidade padrão.</p>
          </div>
          <Button variant="secondary" type="button" onClick={() => setItems((current) => [...current, emptyItem()])}>
            + Adicionar item
          </Button>
        </div>

        <div className="divide-y divide-[#e2e8f0]">
          {items.map((item, index) => {
            const procedure = activeProcedures.find((candidate) => candidate.id === item.procedureId);
            const codes = procedure?.codes.filter((code) => code.active) ?? [];
            return (
              <div key={item.rowId} className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-[minmax(240px,1.2fr)_minmax(300px,1.4fr)_110px_1fr_90px]">
                <Field label={`Procedimento ${index + 1}`}>
                  <Select
                    value={item.procedureId}
                    onChange={(event) => {
                      const nextProcedureId = event.target.value;
                      patchItem(item.rowId, {
                        procedureId: nextProcedureId,
                        defaultCodeId: "",
                        defaultQuantity: "1",
                      });
                    }}
                  >
                    <option value="">Selecione</option>
                    {activeProcedures.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                    ))}
                  </Select>
                </Field>

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
                    onClick={() => setItems((current) => current.length === 1 ? [emptyItem()] : current.filter((candidate) => candidate.rowId !== item.rowId))}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
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
                  id: selectedKitId || undefined,
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
          {pending ? "Salvando..." : selectedKitId ? "Salvar alterações" : "Criar kit"}
        </Button>
      </div>
    </div>
  );
}
