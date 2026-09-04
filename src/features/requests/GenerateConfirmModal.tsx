"use client";

import { useEffect, useMemo, useState } from "react";
import type { Doctor, DocumentTemplate, Institution, Patient, SurgicalRequest } from "@/types/domain";
import { saveRequestAction } from "@/app/actions";
import { Icon } from "@/components/icons";
import { Button, Modal } from "@/components/ui";
import { MEDICAL_REVIEW_STATEMENT } from "@/lib/requests/finalized-snapshot";
import { reviewRequestAction } from "@/features/requests/review-actions";
import type { FinalizationIssue } from "@/lib/requests/finalization-validation";

export function GenerateConfirmModal({
  open,
  request,
  patient,
  doctor,
  institution,
  template,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  request: SurgicalRequest;
  patient?: Patient | null;
  doctor?: Doctor | null;
  institution?: Institution | null;
  template?: DocumentTemplate | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (statement: string) => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [issues, setIssues] = useState<FinalizationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedRevision, setValidatedRevision] = useState<number | null>(null);
  const [reviewItems, setReviewItems] = useState(request.items);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setReviewed(false);
      setValidating(true);
      setValidationError(null);
      setIssues([]);
      setValidatedRevision(null);
      setReviewItems(request.items);

      void saveRequestAction(request)
        .then(async (saved) => {
          if (cancelled) return null;
          setReviewItems(saved.items);
          const result = await reviewRequestAction(request.id, saved.revision);
          return { result, revision: saved.revision };
        })
        .then((validated) => {
          if (!cancelled && validated) {
            setIssues(validated.result);
            setValidatedRevision(validated.revision);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setValidatedRevision(null);
            setValidationError(error instanceof Error ? error.message : "Não foi possível validar a guia.");
          }
        })
        .finally(() => {
          if (!cancelled) setValidating(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, request]);

  const blockingIssues = useMemo(() => issues.filter((issue) => issue.severity === "error"), [issues]);
  const warnings = useMemo(() => issues.filter((issue) => issue.severity === "warning"), [issues]);
  const allQuantitiesValid = reviewItems.length > 0 && reviewItems.every((item) => Number.isInteger(item.quantity) && item.quantity > 0);
  const allTuss = reviewItems.length > 0 && reviewItems.every((item) => Boolean(item.tussCodeSnapshot));
  const allIpasgo = reviewItems.length > 0 && reviewItems.every((item) => Boolean(item.ipasgoCodeSnapshot));

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Revisão final da guia">
      <div className="flex max-h-[80vh] flex-col gap-5 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold">Revisão final da guia</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">
              O rascunho é salvo primeiro. A confirmação médica fica vinculada exatamente à revisão validada no servidor.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 text-[13px] md:grid-cols-2">
          <CheckRow ok={Boolean(patient)} label="Paciente" detail={patient?.fullName ?? "Não selecionado"} />
          <CheckRow
            ok={Boolean(doctor?.crm?.trim())}
            label="Médico / CRM"
            detail={doctor ? `${doctor.name} — CRM ${doctor.crm || "não informado"}/${doctor.crmState || "—"}` : "Não selecionado"}
          />
          <CheckRow ok={Boolean(institution)} label="Instituição" detail={institution?.name ?? "Não selecionada"} />
          <CheckRow
            ok={Boolean(template?.currentVersion)}
            label="Template oficial"
            detail={template?.currentVersion ? `${template.name} — v${template.currentVersion.version}` : "Não selecionado"}
          />
          <CheckRow ok={request.cids.length > 0} label="CID-10" detail={request.cids.map((cid) => cid.codeSnapshot).join(", ") || "Nenhum CID"} />
          <CheckRow ok={reviewItems.length > 0} label="Procedimentos" detail={`${reviewItems.length} selecionado${reviewItems.length === 1 ? "" : "s"}`} />
          <CheckRow ok={allQuantitiesValid} label="Quantidades" detail={allQuantitiesValid ? "Todas maiores que zero" : "Revise as quantidades"} />
          <CheckRow ok={allTuss} label="TUSS" detail={allTuss ? "Todos localizados" : "Há procedimento sem TUSS"} warning={!allTuss} />
          <CheckRow ok={allIpasgo} label="IPASGO" detail={allIpasgo ? "Todos localizados" : "Há procedimento sem IPASGO"} warning={!allIpasgo} />
          <CheckRow
            ok={Boolean(request.clinicalJustification?.trim())}
            label="Justificativa"
            detail={request.clinicalJustification?.trim() ? "Informada" : "Não informada"}
            warning={!request.clinicalJustification?.trim()}
          />
        </div>

        {validating ? (
          <p role="status" className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[13px] text-[#475569]">Salvando e validando template, mappings, códigos e overflow...</p>
        ) : null}
        {validationError ? (
          <p role="alert" className="rounded-lg bg-[#fee2e2] px-3 py-2 text-[13px] text-[#dc2626]">{validationError}</p>
        ) : null}
        {blockingIssues.length > 0 ? (
          <IssueList title="Corrija antes de finalizar" issues={blockingIssues} tone="error" />
        ) : null}
        {warnings.length > 0 ? (
          <IssueList title="Avisos para revisão médica" issues={warnings} tone="warning" />
        ) : null}
        {!validating && !validationError && blockingIssues.length === 0 && validatedRevision !== null ? (
          <p role="status" className="rounded-lg bg-[#f0fdf4] px-3 py-2 text-[13px] text-[#166534]">
            Revisão {validatedRevision} validada no servidor sem erros críticos. {warnings.length > 0 ? `${warnings.length} aviso(s) permanecem para sua revisão.` : "Nenhum aviso pendente."}
          </p>
        ) : null}

        <label className="flex items-start gap-3 text-[13px] font-medium text-[#475569]">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
            className="mt-0.5 size-[18px] rounded border border-[#e2e8f0]"
          />
          <span>{MEDICAL_REVIEW_STATEMENT}</span>
        </label>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Voltar e revisar
          </Button>
          <Button
            type="button"
            disabled={!reviewed || busy || validating || Boolean(validationError) || blockingIssues.length > 0 || validatedRevision === null}
            onClick={() => onConfirm(MEDICAL_REVIEW_STATEMENT)}
          >
            {busy ? "Gerando..." : validating ? "Validando..." : "Gerar PDF definitivo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CheckRow({
  ok,
  label,
  detail,
  warning = false,
}: {
  ok: boolean;
  label: string;
  detail: string;
  warning?: boolean;
}) {
  const symbol = ok ? "✓" : warning ? "⚠" : "✕";
  const className = ok ? "text-[#166534]" : warning ? "text-[#b45309]" : "text-[#b91c1c]";
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
      <div className={`font-semibold ${className}`}>{symbol} {label}</div>
      <div className="mt-0.5 text-[11px] text-[#64748b]">{detail}</div>
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: FinalizationIssue[];
  tone: "error" | "warning";
}) {
  return (
    <div className={`rounded-lg px-3 py-2 text-[13px] ${tone === "error" ? "bg-[#fef2f2] text-[#991b1b]" : "bg-[#fff7ed] text-[#9a3412]"}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {issues.map((issue, index) => <li key={`${issue.code}-${issue.itemId ?? index}`}>{issue.message}</li>)}
      </ul>
    </div>
  );
}
