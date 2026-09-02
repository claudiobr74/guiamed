"use client";

import { useState } from "react";
import { draftJustificationAction } from "@/app/actions";
import type { JustificationFacts } from "@/lib/justification";
import { Icon } from "@/components/icons";
import { Button, Field, Textarea } from "@/components/ui";

export function JustificationDrawer({
  open,
  facts,
  onClose,
  onApply,
}: {
  open: boolean;
  facts: Omit<JustificationFacts, "symptoms" | "evolutionTime" | "clinicalFindings" | "exams" | "previousTreatments" | "functionalLimitation" | "extraNotes" | "tone">;
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    symptoms: "",
    evolutionTime: "",
    previousTreatments: "",
    clinicalFindings: "",
    exams: "",
    functionalLimitation: "",
    extraNotes: "",
  });

  if (!open) return null;

  async function generate(tone?: JustificationFacts["tone"]) {
    setBusy(true);
    try {
      const text = await draftJustificationAction({
        ...facts,
        ...form,
        tone,
      });
      onApply(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col gap-5 overflow-hidden border-l border-[#e2e8f0] bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="sparkle" size={18} />
          <h2 className="text-[16px] font-bold">Gerar justificativa com IA</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        <Field label="Sintomas">
          <Textarea value={form.symptoms} onChange={(e) => setForm((f) => ({ ...f, symptoms: e.target.value }))} className="min-h-16" />
        </Field>
        <Field label="Tempo de evolução">
          <Textarea value={form.evolutionTime} onChange={(e) => setForm((f) => ({ ...f, evolutionTime: e.target.value }))} className="min-h-12" />
        </Field>
        <Field label="Tratamentos prévios">
          <Textarea value={form.previousTreatments} onChange={(e) => setForm((f) => ({ ...f, previousTreatments: e.target.value }))} className="min-h-16" />
        </Field>
        <Field label="Achados de exame físico">
          <Textarea value={form.clinicalFindings} onChange={(e) => setForm((f) => ({ ...f, clinicalFindings: e.target.value }))} className="min-h-16" />
        </Field>
        <Field label="Achados de imagem">
          <Textarea value={form.exams} onChange={(e) => setForm((f) => ({ ...f, exams: e.target.value }))} className="min-h-16" />
        </Field>
        <Field label="Limitação funcional">
          <Textarea value={form.functionalLimitation} onChange={(e) => setForm((f) => ({ ...f, functionalLimitation: e.target.value }))} className="min-h-16" />
        </Field>
        <Field label="Outras informações relevantes">
          <Textarea
            value={form.extraNotes}
            onChange={(e) => setForm((f) => ({ ...f, extraNotes: e.target.value }))}
            placeholder="Digite aqui..."
            className="min-h-16"
          />
        </Field>
      </div>
      <div className="flex flex-col gap-3 pt-3">
        <Button type="button" className="w-full" disabled={busy} onClick={() => void generate()}>
          <Icon name="sparkle" size={12} />
          {busy ? "Gerando..." : "Gerar justificativa"}
        </Button>
        <p className="text-center text-[11px] text-[#475569]">
          O texto gerado será inserido no campo de justificativa para sua revisão. Só entram fatos informados.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["Melhorar", "improve"],
            ["Resumir", "summarize"],
            ["Objetivo", "objective"],
            ["Regenerar", "regenerate"],
          ] as const).map(([label, tone]) => (
            <button
              key={tone}
              type="button"
              className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-medium text-[#475569]"
              onClick={() => void generate(tone)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
