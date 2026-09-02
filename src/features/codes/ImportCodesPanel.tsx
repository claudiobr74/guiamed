"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCodesAction, previewImportCodesAction } from "@/app/actions";
import { Icon } from "@/components/icons";
import { Button, Field, Input, Modal, Select } from "@/components/ui";

type Preview = {
  filename: string;
  sizeBytes: number;
  codeSystem: string;
  inserted: number;
  descriptionChanged: number;
  discontinued: number;
  unchanged: number;
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
            const result = await previewImportCodesAction(formData);
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

      <Modal open={Boolean(preview)} onClose={close}>
        {preview ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">
                Importar atualização — Tabela {preview.codeSystem}
              </h2>
              <button type="button" onClick={close} aria-label="Fechar">
                <Icon name="x-circle" size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#1e5fa6] bg-[#eff6ff] p-4">
              <Icon name="file" size={24} />
              <div>
                <p className="text-[13px] font-semibold text-[#1e5fa6]">{preview.filename}</p>
                <p className="text-[11px] text-[#475569]">
                  {formatSize(preview.sizeBytes)} • Upload concluído com sucesso
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-semibold uppercase text-[#475569]">Resultado do Processamento</p>
              <div className="flex flex-col gap-2">
                <ResultRow tone="green" icon="check" text={`${preview.inserted} novos códigos encontrados`} />
                <ResultRow
                  tone="amber"
                  icon="alert-triangle"
                  text={`${preview.descriptionChanged} códigos com descrição alterada`}
                />
                <ResultRow tone="red" icon="alert-circle" text={`${preview.discontinued} códigos descontinuados`} />
                {preview.unchanged > 0 ? (
                  <ResultRow tone="blue" icon="info" text={`${preview.unchanged} códigos sem alteração`} />
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-[#ffe6cc] bg-[#fff9e6] p-3">
              <Icon name="alert-triangle" size={16} />
              <p className="text-[12px] text-[#7c4600]">
                Códigos existentes nunca são sobrescritos silenciosamente. Revise as alterações antes de confirmar.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={close}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  const form = formRef.current;
                  if (!form) return;
                  start(async () => {
                    const result = await importCodesAction(new FormData(form));
                    if (!result.ok) {
                      setIssues(formatIssues(result.issues));
                      return;
                    }
                    close();
                    router.refresh();
                  });
                }}
              >
                Confirmar importação
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
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
