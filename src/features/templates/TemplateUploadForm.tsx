"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import {
  searchTemplateInstitutionsAction,
  searchTemplateInsurersAction,
} from "@/features/templates/actions";
import {
  cancelTemplateUploadAction,
  completeTemplateUploadAction,
  startTemplateUploadAction,
  uploadTemplateChunkAction,
} from "@/features/templates/upload-actions";
import { templateUploadChunkBounds } from "@/lib/pdf/template-upload";
import { validatePdfUploadMetadata } from "@/lib/pdf/upload-validation";
import type { HealthInsurer, Institution } from "@/types/domain";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

export function TemplateUploadForm() {
  const router = useRouter();
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionResults, setInstitutionResults] = useState<Institution[]>([]);
  const [institutionSearching, setInstitutionSearching] = useState(false);

  const [insurerQuery, setInsurerQuery] = useState("");
  const [insurerId, setInsurerId] = useState("");
  const [insurerResults, setInsurerResults] = useState<HealthInsurer[]>([]);
  const [insurerSearching, setInsurerSearching] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const query = institutionQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setInstitutionSearching(true);
      void searchTemplateInstitutionsAction(query)
        .then((results) => {
          if (!cancelled) setInstitutionResults(results);
        })
        .catch(() => {
          if (!cancelled) setInstitutionResults([]);
        })
        .finally(() => {
          if (!cancelled) setInstitutionSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [institutionQuery]);

  useEffect(() => {
    const query = insurerQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setInsurerSearching(true);
      void searchTemplateInsurersAction(query)
        .then((results) => {
          if (!cancelled) setInsurerResults(results);
        })
        .catch(() => {
          if (!cancelled) setInsurerResults([]);
        })
        .finally(() => {
          if (!cancelled) setInsurerSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [insurerQuery]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;

    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File)) {
      setUploadError("Selecione um arquivo PDF.");
      return;
    }

    let sessionId: string | null = null;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      validatePdfUploadMetadata({ name: file.name, type: file.type, size: file.size });
      const started = await startTemplateUploadAction({
        name: String(form.get("name") || file.name),
        fileName: file.name,
        fileType: file.type || "application/pdf",
        fileSize: file.size,
        institutionId: institutionId || null,
        healthInsurerId: insurerId || null,
      });
      if (!started.ok) throw new Error(started.error);
      sessionId = started.sessionId;

      for (let index = 0; index < started.chunkCount; index += 1) {
        const bounds = templateUploadChunkBounds(file.size, index);
        const chunkForm = new FormData();
        chunkForm.set(
          "chunk",
          file.slice(bounds.start, bounds.end, "application/octet-stream"),
          `${file.name}.${index}.part`,
        );
        const uploaded = await uploadTemplateChunkAction(started.sessionId, index, chunkForm);
        if (!uploaded.ok) throw new Error(uploaded.error);
        setUploadProgress(Math.round(((index + 1) / started.chunkCount) * 90));
      }

      setUploadProgress(95);
      const completed = await completeTemplateUploadAction(started.sessionId);
      if (!completed.ok) throw new Error(completed.error);
      setUploadProgress(100);
      router.push(`/templates/${completed.versionId}/mapper`);
    } catch (error) {
      if (sessionId) await cancelTemplateUploadAction(sessionId);
      setUploadError(error instanceof Error ? error.message : "Não foi possível enviar o PDF.");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
      <Field label="Nome">
        <Input name="name" required placeholder="Solicitação cirúrgica IPASGO" disabled={uploading} />
      </Field>

      <input type="hidden" name="institutionId" value={institutionId} />
      <div className="relative">
        <Field label="Instituição">
          <Input
            value={institutionQuery}
            disabled={uploading}
            onChange={(event) => {
              const next = event.target.value;
              setInstitutionQuery(next);
              if (institutionId) setInstitutionId("");
              if (next.trim().length < MIN_SEARCH_LENGTH) {
                setInstitutionResults([]);
                setInstitutionSearching(false);
              }
            }}
            placeholder="Opcional — digite o início do nome"
            autoComplete="off"
          />
        </Field>
        {institutionSearching ? <p className="mt-1 text-[10px] text-[#64748b]">Buscando instituição...</p> : null}
        {institutionResults.length > 0 ? (
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-[#dbe3ee] bg-white p-1 shadow-sm">
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setInstitutionId("");
                setInstitutionQuery("");
                setInstitutionResults([]);
              }}
              className="block w-full rounded-md px-2 py-2 text-left text-[11px] text-[#64748b] hover:bg-[#f8fafc]"
            >
              Nenhuma instituição
            </button>
            {institutionResults.map((institution) => (
              <button
                key={institution.id}
                type="button"
                disabled={uploading}
                onClick={() => {
                  setInstitutionId(institution.id);
                  setInstitutionQuery(institution.name);
                  setInstitutionResults([]);
                  setInstitutionSearching(false);
                }}
                className="block w-full rounded-md px-2 py-2 text-left hover:bg-[#eff6ff]"
              >
                <span className="block text-[12px] font-semibold text-[#0f172a]">{institution.name}</span>
                <span className="text-[10px] text-[#64748b]">
                  {[institution.city, institution.state].filter(Boolean).join("/") || "local não informado"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {institutionId ? <p className="mt-1 text-[10px] font-medium text-[#166534]">Instituição vinculada.</p> : null}
      </div>

      <input type="hidden" name="healthInsurerId" value={insurerId} />
      <div className="relative">
        <Field label="Operadora">
          <Input
            value={insurerQuery}
            disabled={uploading}
            onChange={(event) => {
              const next = event.target.value;
              setInsurerQuery(next);
              if (insurerId) setInsurerId("");
              if (next.trim().length < MIN_SEARCH_LENGTH) {
                setInsurerResults([]);
                setInsurerSearching(false);
              }
            }}
            placeholder="Opcional — digite o início do nome"
            autoComplete="off"
          />
        </Field>
        {insurerSearching ? <p className="mt-1 text-[10px] text-[#64748b]">Buscando operadora...</p> : null}
        {insurerResults.length > 0 ? (
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-[#dbe3ee] bg-white p-1 shadow-sm">
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setInsurerId("");
                setInsurerQuery("");
                setInsurerResults([]);
              }}
              className="block w-full rounded-md px-2 py-2 text-left text-[11px] text-[#64748b] hover:bg-[#f8fafc]"
            >
              Nenhuma operadora
            </button>
            {insurerResults.map((insurer) => (
              <button
                key={insurer.id}
                type="button"
                disabled={uploading}
                onClick={() => {
                  setInsurerId(insurer.id);
                  setInsurerQuery(insurer.name);
                  setInsurerResults([]);
                  setInsurerSearching(false);
                }}
                className="block w-full rounded-md px-2 py-2 text-left hover:bg-[#eff6ff]"
              >
                <span className="block text-[12px] font-semibold text-[#0f172a]">{insurer.name}</span>
                {insurer.code ? <span className="text-[10px] text-[#64748b]">cód. {insurer.code}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {insurerId ? <p className="mt-1 text-[10px] font-medium text-[#166534]">Operadora vinculada.</p> : null}
      </div>

      <Field label="Arquivo PDF">
        <Input name="file" type="file" accept="application/pdf,.pdf" required disabled={uploading} />
      </Field>
      <p className="text-[10px] leading-4 text-[#64748b]">
        PDFs de até 20 MB são enviados de forma segura em partes. Instituição e operadora são opcionais; texto digitado sem seleção não cria vínculo.
      </p>

      {uploading ? (
        <div role="status" aria-live="polite" className="rounded-lg bg-[#eff6ff] px-3 py-2 text-[11px] text-[#1e5fa6]">
          Enviando e validando PDF… {uploadProgress}%
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#dbeafe]">
            <div className="h-full rounded-full bg-[#1e5fa6] transition-[width]" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : null}
      {uploadError ? (
        <p role="alert" className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[11px] text-[#b91c1c]">
          {uploadError}
        </p>
      ) : null}

      <Button type="submit" disabled={uploading}>
        {uploading ? "Enviando PDF…" : "Enviar e abrir editor"}
      </Button>
    </form>
  );
}
