"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCodesDetailedAction, previewImportCodesDetailedAction } from "@/features/codes/actions";
import { Icon } from "@/components/icons";
import { Button, Field, Input, Modal, Select } from "@/components/ui";

type Issue = { row: number; field: string; message: string };
type Conflict = {
  codeSystem: string;
  code: string;
  version: string;
  kind: "description_changed" | "discontinued" | "reactivated";
  previousDescription: string;
  incomingDescription: string;
};

type Preview = {
  filename: string;
  sizeBytes: number;
  codeSystem: string;
  version: string;
  canImport: boolean;
  validRowCount: number;
  inserted: number;
  descriptionChanged: number;
  discontinued: number;
  reactivated: number;
  unchanged: number;
  conflictCount: number;
  conflicts: Conflict[];
  duplicateCount: number;
  invalidCount: number;
  duplicateIssues: Issue[];
  invalidIssues: Issue[];
};

function formatIssues(issues: Array<{ row: number; message: string }>) {
  const shown = issues.slice(0, 8).map((i) => `Linha ${i.row}: ${i.message}`);
  if (issues.length > 8) shown.push(`e mais ${issues.length - 8} ocorrência(s).`);
  return shown.join(" | ");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function conflictLabel(kind: Conflict["kind"]) {
  if (kind === "discontinued") return "descontinuação";
  if (kind === "reactivated") return "reativação";
  return "descrição alterada";
}

export function ImportCodesPanel() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [issues, setIssues] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setPreview(null);
  }

  return (
    <>
      <form
        ref={formRef}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setIssues(null);
          start(async () => {
            const result = await previewImportCodesDetailedAction(formData);
            if (!result.ok) {
              setIssues(formatIssues(result.issues));
              return;
            }
            setPreview(result);
          });
        }}
      >
        <Field label="Sistema">
          <Select name="codeSystem" defaultValue="TUSS">
            <option value="TUSS">TUSS</option>
            <option value="IPASGO">IPASGO</option>
          </Select>
        </Field>
        <Field label="Versão">
          <Input name="version" required placeholder="2026.1" />
        </Field>
        <Field label="Arquivo">
          <Input name="file" type="file" accept=".csv,.xlsx,.json" required />
        </Field>
        <p className="text-[12px] text-[#475569]">
          Aceita o layout oficial (code, description…) ou tabelas Unimed/TUSS com coluna DESCRIÇÃO e
          código de 8 dígitos, mesmo com título e vigência no topo. A IA não inventa códigos. A
          importação só grava após a confirmação.
        </p>
        {issues ? <p className="text-[12px] text-[#dc2626]">{issues}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Processando..." : "Processar arquivo"}
        </Button>
      </form>

      <Modal open={Boolean(preview)} onClose={close} widthClassName="w-[760px]">
        {preview ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-bold text-[#0f172a]">
                  Importar atualização — Tabela {preview.codeSystem}
                </h2>
                <p className="mt-1 text-[11px] text-[#64748b]">Versão {preview.version}</p>
              </div>
              <button type="button" onClick={close} aria-label="Fechar">
                <Icon name="x-circle" size={14} />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[#1e5fa6] bg-[#eff6ff] p-4">
              <Icon name="file" size={24} />
              <div>
                <p className="text-[13px] font-semibold text-[#1e5fa6]">{preview.filename}</p>
                <p className="text-[11px] text-[#475569]">
                  {formatSize(preview.sizeBytes)} • {preview.validRowCount} linha(s) válida(s) analisada(s)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <SummaryCard label="Conflitos" value={preview.conflictCount} tone="amber" />
              <SummaryCard label="Duplicados" value={preview.duplicateCount} tone="red" />
              <SummaryCard label="Inválidos" value={preview.invalidCount} tone="red" />
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-semibold uppercase text-[#475569]">Resultado do processamento</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <ResultRow tone="green" icon="check" text={`${preview.inserted} novos códigos`} />
                <ResultRow tone="amber" icon="alert-triangle" text={`${preview.descriptionChanged} descrições alteradas`} />
                <ResultRow tone="red" icon="alert-circle" text={`${preview.discontinued} descontinuações`} />
                <ResultRow tone="blue" icon="info" text={`${preview.reactivated} reativações`} />
                {preview.unchanged > 0 ? (
                  <ResultRow tone="blue" icon="info" text={`${preview.unchanged} códigos sem alteração`} />
                ) : null}
              </div>
            </div>

            {preview.conflicts.length > 0 ? (
              <PreviewSection title="Conflitos com a base atual" tone="amber">
                {preview.conflicts.slice(0, 8).map((conflict) => (
                  <div key={`${conflict.codeSystem}-${conflict.code}-${conflict.version}`} className="border-t border-[#fde68a] py-2 first:border-t-0">
                    <p className="text-[11px] font-semibold text-[#92400e]">
                      {conflict.codeSystem} {conflict.code} • {conflictLabel(conflict.kind)}
                    </p>
                    {conflict.kind === "description_changed" ? (
                      <p className="mt-1 text-[11px] text-[#78350f]">
                        Atual: {conflict.previousDescription} → Arquivo: {conflict.incomingDescription}
                      </p>
                    ) : null}
                  </div>
                ))}
                {preview.conflicts.length > 8 ? <p className="text-[11px] text-[#92400e]">e mais {preview.conflicts.length - 8} conflito(s).</p> : null}
              </PreviewSection>
            ) : null}

            {preview.duplicateIssues.length > 0 ? (
              <PreviewSection title="Duplicados no arquivo" tone="red">
                <IssueList issues={preview.duplicateIssues} />
              </PreviewSection>
            ) : null}

            {preview.invalidIssues.length > 0 ? (
              <PreviewSection title="Linhas inválidas" tone="red">
                <IssueList issues={preview.invalidIssues} />
              </PreviewSection>
            ) : null}

            <div className={`flex items-start gap-2.5 rounded-lg border p-3 ${preview.canImport ? "border-[#ffe6cc] bg-[#fff9e6]" : "border-[#fecaca] bg-[#fef2f2]"}`}>
              <Icon name={preview.canImport ? "alert-triangle" : "alert-circle"} size={16} />
              <p className={`text-[12px] ${preview.canImport ? "text-[#7c4600]" : "text-[#991b1b]"}`}>
                {preview.canImport
                  ? "Códigos existentes nunca são sobrescritos silenciosamente. Os vínculos, convênios e quantidades padrão já cadastrados serão preservados."
                  : "A importação está bloqueada até que duplicatas e linhas inválidas sejam corrigidas no arquivo. Conflitos com a base podem ser importados após a revisão."}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={close}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !preview.canImport}
                onClick={() => {
                  const form = formRef.current;
                  if (!form) return;
                  start(async () => {
                    const result = await importCodesDetailedAction(new FormData(form));
                    if (!result.ok) {
                      setIssues(formatIssues(result.issues));
                      close();
                      return;
                    }
                    close();
                    router.refresh();
                  });
                }}
              >
                {pending ? "Importando..." : "Confirmar importação"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "amber" | "red" }) {
  const styles = tone === "amber" ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]" : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]";
  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <p className="text-[10px] font-semibold uppercase">{label}</p>
      <p className="mt-1 text-[20px] font-bold">{value}</p>
    </div>
  );
}

function PreviewSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "amber" | "red";
  children: React.ReactNode;
}) {
  const styles = tone === "amber" ? "border-[#fde68a] bg-[#fffbeb]" : "border-[#fecaca] bg-[#fef2f2]";
  const titleStyle = tone === "amber" ? "text-[#92400e]" : "text-[#991b1b]";
  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <p className={`mb-2 text-[11px] font-bold uppercase ${titleStyle}`}>{title}</p>
      {children}
    </div>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {issues.slice(0, 8).map((issue, index) => (
        <p key={`${issue.row}-${issue.field}-${index}`} className="text-[11px] text-[#991b1b]">
          Linha {issue.row}: {issue.message}
        </p>
      ))}
      {issues.length > 8 ? <p className="text-[11px] text-[#991b1b]">e mais {issues.length - 8} ocorrência(s).</p> : null}
    </div>
  );
}

function ResultRow({
  tone,
  icon,
  text,
}: {
  tone: "green" | "amber" | "red" | "blue";
  icon: "check" | "alert-triangle" | "alert-circle" | "info";
  text: string;
}) {
  const styles = {
    green: "bg-[#ecfdf5] text-[#10b981]",
    amber: "bg-[#fef3c7] text-[#f59e0b]",
    red: "bg-[#fef2f2] text-[#ef4444]",
    blue: "bg-[#eff6ff] text-[#3b82f6]",
  }[tone];
  return (
    <div className={`flex items-center gap-2.5 rounded-md p-3 text-[12px] font-semibold ${styles}`}>
      <Icon name={icon} size={14} />
      <span>{text}</span>
    </div>
  );
}
