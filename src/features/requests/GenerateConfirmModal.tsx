"use client";

import { useState } from "react";
import type { Doctor, DocumentTemplate, Institution, Patient, SurgicalRequest } from "@/types/domain";
import { Icon } from "@/components/icons";
import { Button, Modal } from "@/components/ui";

function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const birth = new Date(iso);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

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
  onConfirm: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const age = ageFromBirthDate(patient?.birthDate);
  const procedureNames = request.items.map((i) => i.procedureName).join(" + ");

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold">Gerar guia?</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="text-[13px] text-[#475569]">
          Confirme os dados clínicos abaixo antes de processar e gerar a guia PDF oficial.
        </p>
        <div className="flex flex-col gap-3">
          <Summary
            label="PACIENTE"
            title={patient?.fullName ?? "—"}
            detail={[patient?.cpf ? `CPF: ${patient.cpf}` : null, age != null ? `${age} anos` : null]
              .filter(Boolean)
              .join(" • ")}
          />
          <Summary
            label="INSTITUIÇÃO / CONVÊNIO"
            title={institution?.name ?? template?.name ?? "—"}
            detail={
              template?.currentVersion
                ? `Template v${template.currentVersion.version}`
                : "Selecione o PDF original da instituição"
            }
          />
          <Summary
            label="MÉDICO SOLICITANTE"
            title={doctor?.name ?? "—"}
            detail={
              doctor
                ? `CRM ${doctor.crm} - ${doctor.crmState}${doctor.rqe ? ` • RQE ${doctor.rqe}` : ""}`
                : ""
            }
          />
          <Summary
            label="PROCEDIMENTOS SELECIONADOS"
            title={`${request.items.length} procedimento${request.items.length === 1 ? "" : "s"}`}
            detail={procedureNames || "Nenhum procedimento"}
          />
        </div>
        <label className="flex items-center gap-3 text-[13px] font-medium text-[#475569]">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
            className="size-[18px] rounded border border-[#e2e8f0]"
          />
          Revisei os dados clínicos e os procedimentos.
        </label>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!reviewed || busy} onClick={onConfirm}>
            {busy ? "Gerando..." : "Gerar PDF"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Summary({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <p className="text-[11px] font-semibold text-[#94a3b8]">{label}</p>
      <p className="text-[14px] font-bold text-[#0f172a]">{title}</p>
      {detail ? <p className="text-[12px] text-[#475569]">{detail}</p> : null}
    </div>
  );
}
