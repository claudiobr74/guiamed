"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  removeDoctorSignatureAction,
  uploadDoctorSignatureAction,
} from "@/features/doctors/signature-actions";

export function SignatureUploader({ doctorId, hasSignature }: { doctorId: string; hasSignature: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stored, setStored] = useState(hasSignature);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectFile(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setMessage(null);
    setError(null);
  }

  async function upload() {
    if (!selectedFile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("signature", selectedFile);
      const result = await uploadDoctorSignatureAction(doctorId, form);
      setStored(true);
      setMessage(`Assinatura salva (${result.width}×${result.height}px).`);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a assinatura.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await removeDoctorSignatureAction(doctorId);
      setStored(false);
      selectFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Assinatura removida do perfil do médico.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover a assinatura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-[13px] font-bold text-[#0f172a]">Imagem da assinatura</h3>
          <p className="mt-1 text-[11px] text-[#64748b]">
            PNG ou JPEG, até 2 MB e 4000×2000 px. O arquivo fica em Storage privado por organização.
          </p>
        </div>

        {stored && !previewUrl ? (
          <p role="status" className="rounded-lg bg-[#ecfdf5] px-3 py-2 text-[12px] text-[#166534]">
            ✓ Há uma imagem de assinatura cadastrada para este médico.
          </p>
        ) : null}

        {previewUrl ? (
          <div className="rounded-lg border border-[#e2e8f0] bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Prévia da assinatura selecionada" className="max-h-32 max-w-full object-contain" />
            <p className="mt-2 text-[11px] text-[#64748b]">Prévia local antes do upload.</p>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          className="block w-full text-[12px] text-[#475569] file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#1e5fa6]"
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !selectedFile} onClick={() => void upload()}>
            {busy && selectedFile ? "Enviando..." : stored ? "Substituir assinatura" : "Salvar assinatura"}
          </Button>
          {stored ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void remove()}>
              Remover assinatura
            </Button>
          ) : null}
        </div>

        {message ? <p role="status" className="text-[12px] text-[#166534]">{message}</p> : null}
        {error ? <p role="alert" className="rounded-lg bg-[#fee2e2] px-3 py-2 text-[12px] text-[#b91c1c]">{error}</p> : null}
        <p className="text-[11px] text-[#64748b]">
          A imagem é apenas reprodução gráfica da assinatura e não equivale a assinatura digital ICP-Brasil.
        </p>
      </div>
    </section>
  );
}
