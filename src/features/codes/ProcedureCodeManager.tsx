"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveProcedureCodeLinkAction,
  searchCodeInsurersAction,
  searchCodeProceduresAction,
} from "@/features/codes/actions";
import { Badge, Button, Input } from "@/components/ui";
import type { HealthInsurer, Procedure, ProcedureCode } from "@/types/domain";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

export function ProcedureCodeManager({
  codes,
  linkedProcedures,
  linkedInsurers,
}: {
  codes: ProcedureCode[];
  linkedProcedures: Procedure[];
  linkedInsurers: HealthInsurer[];
}) {
  const procedureById = useMemo(
    () => new Map(linkedProcedures.map((procedure) => [procedure.id, procedure])),
    [linkedProcedures],
  );
  const insurerById = useMemo(
    () => new Map(linkedInsurers.map((insurer) => [insurer.id, insurer])),
    [linkedInsurers],
  );

  if (codes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#cbd5e1] p-8 text-center text-[13px] text-[#64748b]">
        Nenhum código corresponde aos filtros atuais.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1220px] w-full text-left text-[12px]">
        <thead className="text-[10px] uppercase text-[#64748b]">
          <tr>
            <th className="pb-2 pr-3">Código</th>
            <th className="pb-2 pr-3">Descrição</th>
            <th className="pb-2 pr-3">Procedimento canônico</th>
            <th className="pb-2 pr-3">Convênio / operadora</th>
            <th className="pb-2 pr-3">Qtd. padrão</th>
            <th className="pb-2">Ação</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <CodeLinkRow
              key={code.id}
              code={code}
              initialProcedure={code.procedureId ? procedureById.get(code.procedureId) ?? null : null}
              initialInsurer={code.healthInsurerId ? insurerById.get(code.healthInsurerId) ?? null : null}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeLinkRow({
  code,
  initialProcedure,
  initialInsurer,
}: {
  code: ProcedureCode;
  initialProcedure: Procedure | null;
  initialInsurer: HealthInsurer | null;
}) {
  const router = useRouter();
  const [procedureId, setProcedureId] = useState(code.procedureId ?? "");
  const [procedureName, setProcedureName] = useState(
    initialProcedure?.name ?? (code.procedureId ? "Procedimento atual indisponível" : ""),
  );
  const [healthInsurerId, setHealthInsurerId] = useState(code.healthInsurerId ?? "");
  const [healthInsurerName, setHealthInsurerName] = useState(
    initialInsurer?.name ?? (code.healthInsurerId ? "Operadora atual indisponível" : ""),
  );
  const [quantity, setQuantity] = useState(String(code.defaultQuantity || 1));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed =
    procedureId !== (code.procedureId ?? "") ||
    healthInsurerId !== (code.healthInsurerId ?? "") ||
    Number(quantity) !== code.defaultQuantity;

  return (
    <tr className="border-t border-[#e2e8f0] align-top">
      <td className="py-3 pr-3">
        <div className="font-semibold text-[#0f172a]">{code.code}</div>
        <div className="mt-1 flex gap-1.5">
          <Badge tone={code.codeSystem === "TUSS" ? "blue" : "amber"}>{code.codeSystem}</Badge>
          {!code.active ? <Badge tone="red">inativo</Badge> : null}
        </div>
        <div className="mt-1 text-[10px] text-[#64748b]">v. {code.version}</div>
      </td>
      <td className="max-w-[300px] py-3 pr-3 text-[#475569]">{code.description}</td>
      <td className="w-[270px] py-3 pr-3">
        <RelationPicker<Procedure>
          selectedId={procedureId}
          selectedName={procedureName}
          emptyLabel="Sem vínculo"
          placeholder="Buscar procedimento"
          search={searchCodeProceduresAction}
          onSelect={(id, name) => {
            setProcedureId(id);
            setProcedureName(name);
          }}
        />
      </td>
      <td className="w-[250px] py-3 pr-3">
        <RelationPicker<HealthInsurer>
          selectedId={healthInsurerId}
          selectedName={healthInsurerName}
          emptyLabel="Geral / qualquer convênio"
          placeholder="Buscar operadora"
          search={searchCodeInsurersAction}
          onSelect={(id, name) => {
            setHealthInsurerId(id);
            setHealthInsurerName(name);
          }}
        />
      </td>
      <td className="w-[105px] py-3 pr-3">
        <Input
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-label={`Quantidade padrão de ${code.code}`}
        />
      </td>
      <td className="w-[130px] py-3">
        <Button
          type="button"
          className="w-full"
          disabled={pending || !changed || !Number.isInteger(Number(quantity)) || Number(quantity) < 1}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              try {
                await saveProcedureCodeLinkAction({
                  codeId: code.id,
                  procedureId: procedureId || null,
                  healthInsurerId: healthInsurerId || null,
                  defaultQuantity: Number(quantity),
                });
                setMessage("Salvo");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Falha ao salvar");
              }
            });
          }}
        >
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        {message ? (
          <p className={`mt-1 text-[10px] ${message === "Salvo" ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{message}</p>
        ) : null}
      </td>
    </tr>
  );
}

function RelationPicker<T extends { id: string; name: string }>({
  selectedId,
  selectedName,
  emptyLabel,
  placeholder,
  search,
  onSelect,
}: {
  selectedId: string;
  selectedName: string;
  emptyLabel: string;
  placeholder: string;
  search: (query: string) => Promise<T[]>;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const value = query.trim();
    if (value.length < MIN_SEARCH_LENGTH) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setSearching(true);
      void search(value)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, search]);

  return (
    <div className="flex min-w-[220px] flex-col gap-1.5">
      <div className="flex min-h-8 items-center justify-between gap-2 rounded-md bg-[#f8fafc] px-2 py-1.5">
        <span className={`truncate text-[11px] ${selectedId ? "font-semibold text-[#0f172a]" : "text-[#64748b]"}`}>
          {selectedId ? selectedName : emptyLabel}
        </span>
        {selectedId ? (
          <button
            type="button"
            className="shrink-0 text-[10px] font-semibold text-[#64748b] hover:text-[#dc2626]"
            onClick={() => {
              onSelect("", "");
              setQuery("");
              setResults([]);
            }}
          >
            Remover
          </button>
        ) : null}
      </div>
      <Input
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          if (next.trim().length < MIN_SEARCH_LENGTH) {
            setResults([]);
            setSearching(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {searching ? <span className="text-[10px] text-[#64748b]">Buscando...</span> : null}
      {results.length > 0 ? (
        <div className="max-h-40 overflow-auto rounded-md border border-[#dbe3ee] bg-white p-1 shadow-sm">
          {results.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium text-[#0f172a] hover:bg-[#eff6ff]"
              onClick={() => {
                onSelect(item.id, item.name);
                setQuery("");
                setResults([]);
                setSearching(false);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
