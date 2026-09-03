"use client";

import { useMemo, useState } from "react";
import type { ProcedureKit } from "@/types/domain";
import { Icon } from "@/components/icons";
import { Button, Modal } from "@/components/ui";

export function KitPickerModal({
  open,
  kits,
  onClose,
  onSelect,
}: {
  open: boolean;
  kits: ProcedureKit[];
  onClose: () => void;
  onSelect: (kit: ProcedureKit) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(kits[0]?.id ?? null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return kits;
    return kits.filter((kit) => {
      const hay = [kit.name, kit.specialty ?? "", ...kit.items.map((i) => i.procedureName)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [kits, query]);
  const selected = filtered.find((k) => k.id === selectedId) ?? filtered[0] ?? null;

  return (
    <Modal open={open} onClose={onClose} widthClassName="w-[960px]" ariaLabel="Kits de procedimentos">
      <div className="flex max-h-[82dvh] min-h-0 flex-col gap-4 sm:gap-6 lg:h-[min(680px,80vh)]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-[#0f172a]">Kits de procedimentos</h2>
            <p className="mt-1 text-[12px] text-[#475569]">
              Selecione um modelo de kit pré-configurado para carregar os procedimentos
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="x-circle" size={14} />
          </button>
        </div>
        <label className="flex items-center gap-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <Icon name="search-lg" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar kits por nome, especialidade ou procedimento..."
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#64748b]"
          />
        </label>
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#475569]">Nenhum kit cadastrado ou encontrado.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto lg:flex-row lg:gap-6 lg:overflow-hidden">
            <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 sm:grid-cols-2 lg:overflow-auto">
              {filtered.map((kit) => {
                const active = selected?.id === kit.id;
                return (
                  <button
                    key={kit.id}
                    type="button"
                    onClick={() => setSelectedId(kit.id)}
                    className={`flex flex-col gap-3 rounded-[10px] p-4 text-left ${
                      active
                        ? "border-2 border-[#1e5fa6] bg-[#eff6ff]"
                        : "border border-[#e2e8f0] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-[#0f172a]">{kit.name}</p>
                      <span className="rounded border border-[#e2e8f0] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#475569]">
                        {kit.items.length} itens
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#475569]">{kit.specialty ?? "—"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <aside className="flex w-full shrink-0 flex-col gap-4 overflow-auto rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 lg:w-[340px] lg:p-5">
              <p className="text-[13px] font-bold">Procedimentos Inclusos</p>
              {selected?.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-white p-2.5"
                >
                  <p className="truncate text-[12px] font-medium text-[#475569]">{item.procedureName}</p>
                  <span className="rounded bg-[#eff6ff] px-2 py-0.5 text-[11px] font-bold text-[#1e5fa6]">
                    Qtd: {item.defaultQuantity}
                  </span>
                </div>
              ))}
            </aside>
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-[#e2e8f0] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[#64748b]">
            * Os itens selecionados preencherão automaticamente a etapa 3 do formulário.
          </p>
          <div className="flex flex-wrap gap-3 sm:flex-nowrap">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                onSelect(selected);
              }}
            >
              Usar kit selecionado
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
