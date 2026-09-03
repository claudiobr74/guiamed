"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import {
  searchTemplateInstitutionsAction,
  searchTemplateInsurersAction,
  uploadTemplateAndRedirectAction,
} from "@/features/templates/actions";
import type { HealthInsurer, Institution } from "@/types/domain";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

export function TemplateUploadForm() {
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionResults, setInstitutionResults] = useState<Institution[]>([]);
  const [institutionSearching, setInstitutionSearching] = useState(false);

  const [insurerQuery, setInsurerQuery] = useState("");
  const [insurerId, setInsurerId] = useState("");
  const [insurerResults, setInsurerResults] = useState<HealthInsurer[]>([]);
  const [insurerSearching, setInsurerSearching] = useState(false);

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

  return (
    <form action={uploadTemplateAndRedirectAction} className="flex flex-col gap-3">
      <Field label="Nome">
        <Input name="name" required placeholder="Solicitação cirúrgica IPASGO" />
      </Field>

      <input type="hidden" name="institutionId" value={institutionId} />
      <div className="relative">
        <Field label="Instituição">
          <Input
            value={institutionQuery}
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
        <Input name="file" type="file" accept="application/pdf" required />
      </Field>
      <p className="text-[10px] leading-4 text-[#64748b]">
        Instituição e operadora são opcionais. Para vinculá-las, escolha um resultado da busca; texto digitado sem seleção não cria vínculo.
      </p>
      <Button type="submit">Enviar e abrir editor</Button>
    </form>
  );
}
