"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { duplicateRequestAction } from "@/app/actions";
import { Button, Card, Field, Modal, Textarea } from "@/components/ui";
import { cancelRequestAction } from "@/features/requests/review-actions";
import { CODE_NOT_FOUND, type DocumentTemplate, type SurgicalRequest } from "@/types/domain";

export function FinalizedRequestView({
  request,
  template,
}: {
  request: SurgicalRequest;
  template: DocumentTemplate | null;
}) {
  const router = useRouter();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCancelled = request.status === "cancelled";

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelRequestAction(request.id, reason);
      setShowCancel(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cancelar a guia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="status"
        className={`rounded-xl border px-4 py-3 text-[13px] ${
          isCancelled
            ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
            : "border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a]"
        }`}
      >
        <strong>{isCancelled ? "Guia cancelada." : "Guia finalizada e bloqueada para edição."}</strong>{" "}
        O documento histórico permanece preservado. Para alterar dados clínicos, duplique a guia.
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">Resumo da guia</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">
              {request.finalizedAt ? `Finalizada em ${new Date(request.finalizedAt).toLocaleString("pt-BR")}` : "Documento histórico"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/guias/${request.id}/preview`}>
              <Button type="button">Visualizar / baixar PDF</Button>
            </Link>
            <form action={duplicateRequestAction.bind(null, request.id)}>
              <Button type="submit" variant="secondary">Duplicar para nova versão</Button>
            </form>
            {!isCancelled ? (
              <Button type="button" variant="secondary" onClick={() => setShowCancel(true)}>
                Cancelar guia
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 text-[13px] md:grid-cols-2">
          <Summary label="Paciente" value={request.patient?.fullName ?? "—"} />
          <Summary
            label="Médico / CRM"
            value={
              request.doctor
                ? `${request.doctor.name} — CRM ${request.doctor.crm}/${request.doctor.crmState}`
                : "—"
            }
          />
          <Summary label="Instituição" value={request.institution?.name ?? "—"} />
          <Summary
            label="Template oficial"
            value={template?.currentVersion ? `${template.name} — v${template.currentVersion.version}` : template?.name ?? "—"}
          />
          <Summary
            label="CID-10"
            value={request.cids.map((cid) => `${cid.codeSnapshot} — ${cid.descriptionSnapshot}`).join("; ") || "—"}
            wide
          />
          <Summary label="Diagnóstico" value={request.diagnosis ?? "—"} wide />
          <div className="md:col-span-2">
            <dt className="mb-2 text-[11px] font-semibold uppercase text-[#94a3b8]">Procedimentos</dt>
            <dd>
              <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
                <table className="w-full min-w-[680px] text-left text-[12px]">
                  <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b]">
                    <tr>
                      <th className="px-3 py-2">Procedimento</th>
                      <th className="px-3 py-2">TUSS</th>
                      <th className="px-3 py-2">IPASGO</th>
                      <th className="px-3 py-2">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.items.map((item) => (
                      <tr key={item.id} className="border-t border-[#e2e8f0]">
                        <td className="px-3 py-2 font-semibold">{item.procedureName}</td>
                        <td className="px-3 py-2">{item.tussCodeSnapshot ?? CODE_NOT_FOUND}</td>
                        <td className="px-3 py-2">{item.ipasgoCodeSnapshot ?? CODE_NOT_FOUND}</td>
                        <td className="px-3 py-2">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </dd>
          </div>
          <Summary label="Justificativa clínica" value={request.clinicalJustification ?? "—"} wide preserveWhitespace />
        </dl>
      </Card>

      <Modal open={showCancel} onClose={() => !busy && setShowCancel(false)}>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[18px] font-bold">Cancelar guia finalizada?</h2>
            <p className="mt-2 text-[13px] text-[#64748b]">
              O PDF não será apagado. O cancelamento ficará registrado no histórico e na auditoria.
            </p>
          </div>
          <Field label="Motivo do cancelamento">
            <Textarea
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Informe o motivo para manter a rastreabilidade."
              className="min-h-24"
            />
          </Field>
          {error ? <p role="alert" className="rounded-lg bg-[#fee2e2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowCancel(false)}>
              Voltar
            </Button>
            <Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void cancel()}>
              {busy ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Summary({
  label,
  value,
  wide = false,
  preserveWhitespace = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
  preserveWhitespace?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <dt className="text-[11px] font-semibold uppercase text-[#94a3b8]">{label}</dt>
      <dd className={`mt-1 font-medium text-[#0f172a] ${preserveWhitespace ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
    </div>
  );
}
