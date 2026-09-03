"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProcedureCodeLinkAction } from "@/features/codes/actions";
import { Badge, Button, Input, Select } from "@/components/ui";
import type { HealthInsurer, Procedure, ProcedureCode } from "@/types/domain";

export function ProcedureCodeManager({
  codes,
  procedures,
  insurers,
}: {
  codes: ProcedureCode[];
  procedures: Procedure[];
  insurers: HealthInsurer[];
}) {
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState("ALL");
  const [linkState, setLinkState] = useState("unlinked");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return codes.filter((code) => {
      if (system !== "ALL" && code.codeSystem !== system) return false;
      if (linkState === "unlinked" && code.procedureId) return false;
      if (linkState === "linked" && !code.procedureId) return false;
      if (!needle) return true;
      const procedure = procedures.find((item) => item.id === code.procedureId);
      return `${code.code} ${code.description} ${procedure?.name ?? ""}`.toLowerCase().includes(needle);
    });
  }, [codes, procedures, query, system, linkState]);

  const visible = filtered.slice(0, 200);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[#f8fafc] p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Buscar código ou descrição</label>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: 31403019 ou artrodese" />
        </div>
        <div className="w-[150px]">
          <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Sistema</label>
          <Select value={system} onChange={(event) => setSystem(event.target.value)}>
            <option value="ALL">Todos</option>
            <option value="TUSS">TUSS</option>
            <option value="IPASGO">IPASGO</option>
          </Select>
        </div>
        <div className="w-[170px]">
          <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Vínculo</label>
          <Select value={linkState} onChange={(event) => setLinkState(event.target.value)}>
            <option value="unlinked">Sem vínculo</option>
            <option value="linked">Vinculados</option>
            <option value="all">Todos</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] text-[#64748b]">
        <span>{filtered.length} código(s) encontrado(s)</span>
        {filtered.length > visible.length ? <span>Mostrando os primeiros {visible.length}</span> : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#cbd5e1] p-8 text-center text-[13px] text-[#64748b]">
          Nenhum código corresponde aos filtros atuais.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-[12px]">
            <thead className="text-[10px] uppercase text-[#94a3b8]">
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
              {visible.map((code) => (
                <CodeLinkRow key={code.id} code={code} procedures={procedures} insurers={insurers} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CodeLinkRow({
  code,
  procedures,
  insurers,
}: {
  code: ProcedureCode;
  procedures: Procedure[];
  insurers: HealthInsurer[];
}) {
  const router = useRouter();
  const [procedureId, setProcedureId] = useState(code.procedureId ?? "");
  const [healthInsurerId, setHealthInsurerId] = useState(code.healthInsurerId ?? "");
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
        <div className="mt-1 text-[10px] text-[#94a3b8]">v. {code.version}</div>
      </td>
      <td className="max-w-[320px] py-3 pr-3 text-[#475569]">{code.description}</td>
      <td className="py-3 pr-3">
        <Select value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
          <option value="">Sem vínculo</option>
          {procedures.map((procedure) => (
            <option key={procedure.id} value={procedure.id}>{procedure.name}</option>
          ))}
        </Select>
      </td>
      <td className="py-3 pr-3">
        <Select value={healthInsurerId} onChange={(event) => setHealthInsurerId(event.target.value)}>
          <option value="">Geral / qualquer convênio</option>
          {insurers.filter((item) => item.active).map((insurer) => (
            <option key={insurer.id} value={insurer.id}>{insurer.name}</option>
          ))}
        </Select>
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
