"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Modal } from "@/components/ui";
import { Icon } from "@/components/icons";
import {
  cancelTussTableUploadAction,
  completeTussTableUploadAction,
  previewTussTableUploadAction,
  startTussTableUploadAction,
  uploadTussTableChunkAction,
} from "@/features/codes/tuss-table-upload-actions";

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
  tableName: string;
  tableKey: string;
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

function issuesText(issues: Issue[]) {
  const shown = issues.slice(0, 8).map((issue) => `Linha ${issue.row}: ${issue.message}`);
  if (issues.length > 8) shown.push(`e mais ${issues.length - 8} ocorrência(s).`);
  return shown.join(" | ");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TussTableImportPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tableName, setTableName] = useState("");
  const [version, setVersion] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [pending, startTransition] = useTransition();

  async function cancelSession() {
    const current = sessionId;
    setPreview(null);
    setSessionId(null);
    setProgress(0);
    if (current) await cancelTussTableUploadAction(current);
  }

  function reset() {
    setTableName("");
    setVersion("");
    setPreview(null);
    setSessionId(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const file = fileRef.current?.files?.[0];
          if (!file) {
            setMessage("Selecione o arquivo da Tabela TUSS.");
            return;
          }
          setMessage(null);
          setProgress(0);
          startTransition(async () => {
            const started = await startTussTableUploadAction({
              fileName: file.name,
              fileSize: file.size,
              tableName,
              version,
            });
            if (!started.ok) {
              setMessage(issuesText(started.issues));
              return;
            }
            setSessionId(started.sessionId);

            for (let index = 0; index < started.chunkCount; index += 1) {
              const start = index * started.chunkSize;
              const end = Math.min(start + started.chunkSize, file.size);
              const body = new FormData();
              body.set(
                "chunk",
                new File([file.slice(start, end)], `${file.name}.part-${index}`, {
                  type: "application/octet-stream",
                }),
              );
              const uploaded = await uploadTussTableChunkAction(started.sessionId, index, body);
              if (!uploaded.ok) {
                setMessage(issuesText(uploaded.issues));
                await cancelTussTableUploadAction(started.sessionId);
                setSessionId(null);
                setProgress(0);
                return;
              }
              setProgress(Math.round(((index + 1) / started.chunkCount) * 100));
            }

            const result = await previewTussTableUploadAction(started.sessionId);
            if (!result.ok) {
              setMessage(issuesText(result.issues));
              await cancelTussTableUploadAction(started.sessionId);
              setSessionId(null);
              setProgress(0);
              return;
            }
            setPreview(result);
          });
        }}
      >
        <Field label="Identificação da Tabela TUSS">
          <Input
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            required
            placeholder="Ex.: Unimed Goiânia, IPASGO, Particular"
          />
        </Field>
        <Field label="Versão">
          <Input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            required
            placeholder="Ex.: 2026.1"
          />
        </Field>
        <Field label="Arquivo oficial">
          <Input ref={fileRef} type="file" accept=".csv,.xlsx,.json" required />
        </Field>
        <p className="text-[12px] leading-5 text-[#475569]">
          CSV, XLSX ou JSON, até 20 MB. Cada arquivo fica isolado como uma Tabela TUSS própria.
          Durante a elaboração da guia o médico escolhe manualmente qual tabela usar.
        </p>
        {pending || progress > 0 ? (
          <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3" role="status" aria-live="polite">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#1e5fa6]">
              <span>{progress < 100 ? "Enviando tabela..." : "Analisando tabela..."}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#dbeafe]">
              <div className="h-full bg-[#1e5fa6] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
        {message ? <p role="alert" className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b]">{message}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Processando..." : "Enviar e analisar tabela"}
        </Button>
      </form>

      <Modal
        open={Boolean(preview)}
        onClose={() => void cancelSession()}
        widthClassName="w-[760px]"
        ariaLabel="Confirmar importação da Tabela TUSS"
      >
        {preview ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Tabela TUSS</p>
                <h2 className="mt-1 text-[18px] font-bold text-[#0f172a]">{preview.tableName}</h2>
                <p className="mt-1 text-[11px] text-[#64748b]">Versão {preview.version}</p>
              </div>
              <button type="button" onClick={() => void cancelSession()} aria-label="Fechar">
                <Icon name="x-circle" size={16} />
              </button>
            </div>

            <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-4">
              <p className="text-[13px] font-semibold text-[#1e5fa6]">{preview.filename}</p>
              <p className="mt-1 text-[11px] text-[#475569]">
                {formatSize(preview.sizeBytes)} • {preview.validRowCount.toLocaleString("pt-BR")} linha(s) válida(s)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Summary label="Novos" value={preview.inserted} />
              <Summary label="Conflitos" value={preview.conflictCount} />
              <Summary label="Duplicados" value={preview.duplicateCount} />
              <Summary label="Inválidos" value={preview.invalidCount} />
            </div>

            {preview.conflicts.length > 0 ? (
              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                <p className="mb-2 text-[11px] font-bold uppercase text-[#92400e]">Conflitos com esta mesma tabela</p>
                {preview.conflicts.slice(0, 8).map((conflict) => (
                  <p key={`${conflict.code}-${conflict.version}-${conflict.kind}`} className="border-t border-[#fde68a] py-2 text-[11px] text-[#78350f] first:border-t-0">
                    TUSS {conflict.code} • {conflict.kind === "description_changed" ? "descrição alterada" : conflict.kind === "discontinued" ? "descontinuação" : "reativação"}
                  </p>
                ))}
              </div>
            ) : null}

            {preview.duplicateIssues.length > 0 || preview.invalidIssues.length > 0 ? (
              <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-[11px] text-[#991b1b]">
                {[...preview.duplicateIssues, ...preview.invalidIssues].slice(0, 10).map((issue, index) => (
                  <p key={`${issue.row}-${issue.field}-${index}`}>Linha {issue.row}: {issue.message}</p>
                ))}
              </div>
            ) : null}

            <p className={`rounded-lg px-3 py-2 text-[12px] ${preview.canImport ? "bg-[#ecfdf5] text-[#166534]" : "bg-[#fef2f2] text-[#991b1b]"}`}>
              {preview.canImport
                ? "A tabela está pronta para importação. Nenhum código de outra tabela será alterado."
                : "Corrija duplicatas e linhas inválidas antes de importar."}
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => void cancelSession()}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || !preview.canImport || !sessionId}
                onClick={() => {
                  const currentSession = sessionId;
                  if (!currentSession) return;
                  setMessage(null);
                  startTransition(async () => {
                    const result = await completeTussTableUploadAction(currentSession);
                    if (!result.ok) {
                      setMessage(issuesText(result.issues));
                      setPreview(null);
                      return;
                    }
                    reset();
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

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase text-[#64748b]">{label}</p>
      <p className="mt-1 text-[18px] font-bold text-[#0f172a]">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
