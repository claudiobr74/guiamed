"use client";

import { useState, useTransition } from "react";
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
  if (codes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#cbd5e1] p-8 text-center text-[13px] text-[#64748b]">
        Nenhum código corresponde aos filtros atuais.
      </div>
    );
  }

  return (
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
          {codes.map((code) => (
            <CodeLinkRow key={code.id} code={code} procedures={procedures} insurers={insurers} />
          ))}
        </tbody>
      </table>
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
