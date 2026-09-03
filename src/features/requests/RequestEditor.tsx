"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CODE_NOT_FOUND, type CidCode, type Doctor, type DocumentTemplate, type HealthInsurer, type Institution, type Patient, type Procedure, type ProcedureKit, type SurgicalRequest } from "@/types/domain";
import { Badge, Button, Card, Field, Input, QuantityStepper, Select, Textarea } from "@/components/ui";
import { Icon } from "@/components/icons";
import { KitPickerModal } from "@/features/requests/KitPickerModal";
import { JustificationDrawer } from "@/features/requests/JustificationDrawer";
import { GenerateConfirmModal } from "@/features/requests/GenerateConfirmModal";
import {
  duplicateRequestAction,
  generatePdfAction,
  savePatientAction,
  saveRequestAction,
  searchCidsAction,
  searchPatientsAction,
  searchProceduresAction,
} from "@/app/actions";
import { parseQuantity } from "@/lib/quantity";
import { quantityForCodes, resolveProcedureCode } from "@/lib/codes";
import { resolveTemplateSelection } from "@/lib/templates/compatibility";
import { maskCpf } from "@/lib/personal-data";

const STEPS = ["Paciente", "Diagnóstico", "Procedimentos", "Justificativa", "Revisão"] as const;
const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

export function RequestEditor({
  initial,
  patients,
  doctors,
  institutions,
  insurers,
  templates,
  kits,
  kitProcedures,
}: {
  initial: SurgicalRequest;
  patients: Patient[];
  doctors: Doctor[];
  institutions: Institution[];
  insurers: HealthInsurer[];
  templates: DocumentTemplate[];
  kits: ProcedureKit[];
  kitProcedures: Procedure[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [request, setRequest] = useState(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>(patients);
  const [procQuery, setProcQuery] = useState("");
  const [procResults, setProcResults] = useState<Procedure[]>([]);
  const [cidQuery, setCidQuery] = useState("");
  const [cidResults, setCidResults] = useState<CidCode[]>([]);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(initial);
  const saveInFlight = useRef<Promise<boolean> | null>(null);
  const saveQueued = useRef(false);
  const skipAutosave = useRef(false);
  const clientSequence = useRef(0);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === request.patientId) ?? patientResults.find((p) => p.id === request.patientId) ?? request.patient,
    [patients, patientResults, request.patientId, request.patient],
  );
  const selectedDoctor = doctors.find((d) => d.id === request.doctorId) ?? request.doctor;
  const selectedInstitution = institutions.find((i) => i.id === request.institutionId) ?? request.institution;
  const selectedTemplate = templates.find((t) => t.id === request.templateId);
  const compatibleTemplates = useMemo(
    () => resolveTemplateSelection({ templates, institutionId: request.institutionId, healthInsurerId: request.healthInsurerId, selectedTemplateId: request.templateId }).templates,
    [templates, request.institutionId, request.healthInsurerId, request.templateId],
  );
  const kitProcedureById = useMemo(
    () => new Map(kitProcedures.map((procedure) => [procedure.id, procedure])),
    [kitProcedures],
  );

  const persist = useCallback(async (): Promise<boolean> => {
    if (saveInFlight.current) {
      saveQueued.current = true;
      return saveInFlight.current;
    }
    const run = async () => {
      do {
        saveQueued.current = false;
        const snapshot = requestRef.current;
        const sequence = clientSequence.current;
        setSaveState("saving");
        try {
          const saved = await saveRequestAction(snapshot);
          const hasNewerClientChanges = clientSequence.current !== sequence;
          const next = {
            ...requestRef.current,
            updatedAt: saved.updatedAt,
            revision: saved.revision,
            items: hasNewerClientChanges ? requestRef.current.items : saved.items,
          };
          requestRef.current = next;
          skipAutosave.current = !hasNewerClientChanges;
          setRequest(next);
          setSaveState("saved");
          setSaveError(null);
          if (hasNewerClientChanges) saveQueued.current = true;
        } catch (error) {
          setSaveState("error");
          setSaveError(error instanceof Error ? error.message : "Erro ao salvar");
          return false;
        }
      } while (saveQueued.current);
      return true;
    };
    saveInFlight.current = run().finally(() => {
      saveInFlight.current = null;
    });
    return saveInFlight.current;
  }, []);

  useEffect(() => {
    if (request.status !== "draft") return;
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist();
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [persist, request]);

  useEffect(() => {
    const query = patientQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    let cancelled = false;
    const searchTimer = setTimeout(() => {
      void searchPatientsAction(query)
        .then((results) => {
          if (!cancelled) setPatientResults(results);
        })
        .catch(() => {
          if (!cancelled) setPatientResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(searchTimer);
    };
  }, [patientQuery]);

  useEffect(() => {
    const query = cidQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    let cancelled = false;
    const searchTimer = setTimeout(() => {
      void searchCidsAction(query)
        .then((results) => {
          if (!cancelled) setCidResults(results);
        })
        .catch(() => {
          if (!cancelled) setCidResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(searchTimer);
    };
  }, [cidQuery]);

  useEffect(() => {
    const query = procQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    let cancelled = false;
    const searchTimer = setTimeout(() => {
      void searchProceduresAction(query)
        .then((results) => {
          if (!cancelled) setProcResults(results);
        })
        .catch(() => {
          if (!cancelled) setProcResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(searchTimer);
    };
  }, [procQuery]);

  function patch(partial: Partial<SurgicalRequest>) {
    clientSequence.current += 1;
    const next = { ...requestRef.current, ...partial };
    requestRef.current = next;
    setRequest(next);
    if (saveInFlight.current) saveQueued.current = true;
  }

  function applyTemplateContext(institutionId: string | null, healthInsurerId: string | null) {
    const resolved = resolveTemplateSelection({
      templates,
      institutionId,
      healthInsurerId,
      selectedTemplateId: request.templateId,
    });
    setTemplateNotice(
      resolved.invalidated
        ? "O template anterior não é compatível com a instituição ou o convênio selecionado e foi removido."
        : null,
    );
    patch({
      institutionId,
      healthInsurerId,
      templateId: resolved.templateId,
      templateVersionId: resolved.templateVersionId,
    });
  }

  function applyPatient(patient: Patient) {
    const resolved = resolveTemplateSelection({
      templates,
      institutionId: request.institutionId,
      healthInsurerId: patient.healthInsurerId,
      selectedTemplateId: request.templateId,
    });
    setTemplateNotice(
      resolved.invalidated
        ? "O template anterior não é compatível com o convênio do paciente e foi removido."
        : null,
    );
    patch({
      patientId: patient.id,
      patient,
      healthInsurerId: patient.healthInsurerId,
      templateId: resolved.templateId,
      templateVersionId: resolved.templateVersionId,
    });
  }

  async function onGenerate(statement: string) {
    setBusy(true);
    try {
      if (!(await persist())) return;
      const doc = await generatePdfAction(request.id, { accepted: true, statement });
      router.push(`/guias/${request.id}/preview?doc=${doc.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-0">
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex w-full items-center gap-4 overflow-x-auto pb-1 xl:w-auto">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true" className="text-[13px] text-[#cbd5e1]">›</span> : null}
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={index === step ? "step" : undefined}
                aria-label={`Etapa ${index + 1}: ${label}`}
                className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  index === step ? "bg-[#1e5fa6] text-white" : index < step ? "bg-[#16a34a] text-white" : "bg-[#f1f5f9] text-[#475569]"
                }`}
              >
                {index + 1}
              </button>
              <span className={`text-[12px] ${index === step ? "font-semibold text-[#1e5fa6]" : "text-[#475569]"}`}>
                {label}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
          <span role="status" aria-live="polite" className="text-[12px] text-[#64748b]">
            {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : ""}
          </span>
          <Button variant="secondary" type="button" onClick={() => void persist()} disabled={request.status !== "draft"}>
            Salvar rascunho
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={async () => {
              setBusy(true);
              try {
                if (!(await persist())) return;
                router.push(`/guias/${request.id}/preview`);
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : "Não foi possível gerar o preview.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Visualizar PDF
          </Button>
          {step < 4 ? (
            <Button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
              Avançar
            </Button>
          ) : (
            <Button type="button" onClick={() => setShowGenerate(true)} disabled={busy || request.status !== "draft"}>
              Finalizar e gerar PDF
            </Button>
          )}
        </div>
      </div>
      {saveError ? <p role="alert" className="rounded-lg bg-[#fee2e2] px-3 py-2 text-[13px] text-[#dc2626]">{saveError}</p> : null}
      {templateNotice ? <p role="status" className="rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] text-[#b45309]">{templateNotice}</p> : null}

      {step === 0 ? (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-bold">Paciente</h2>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="text-[12px] font-semibold text-[#1e5fa6]" onClick={() => patch({ patientId: null, patient: null })}>
                  Trocar paciente
                </button>
                <Button variant="subtle" className="px-3 py-1.5 text-[11px]" type="button" onClick={() => setShowNewPatient((v) => !v)}>
                  + Novo paciente
                </Button>
              </div>
            </div>
            {!request.patientId ? (
              <Field label="Buscar paciente">
                <Input
                  value={patientQuery}
                  placeholder="Nome ou CPF"
                  onChange={(e) => {
                    const q = e.target.value;
                    setPatientQuery(q);
                    if (!q.trim()) setPatientResults(patients);
                    else if (q.trim().length < MIN_SEARCH_LENGTH) setPatientResults([]);
                  }}
                />
                <ul className="mt-2 divide-y divide-[#e2e8f0] rounded-lg border border-[#e2e8f0]">
                  {patientResults.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[#eff6ff]"
                        onClick={() => applyPatient(p)}
                      >
                        <span className="font-semibold">{p.fullName}</span>
                        <span className="text-[#64748b]">{p.cpf ? maskCpf(p.cpf) : "sem CPF"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Field>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg bg-[#eff6ff] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[14px] font-bold text-[#1e5fa6]">{selectedPatient?.fullName}</p>
                  <p className="text-[12px] text-[#475569]">
                    Nascimento: {selectedPatient?.birthDate ?? "—"} • CPF: {selectedPatient?.cpf ? maskCpf(selectedPatient.cpf) : "—"}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[13px] font-semibold">Convênio: {selectedPatient?.healthInsurerName ?? "—"}</p>
                  <p className="text-[11px] text-[#475569]">Carteirinha: {selectedPatient?.insuranceCard ?? "—"}</p>
                </div>
              </div>
            )}
            {showNewPatient ? <NewPatientForm onCreated={(p) => { applyPatient(p); setShowNewPatient(false); }} insurers={insurers} /> : null}
          </Card>
          <Card>
            <h2 className="mb-4 text-[14px] font-bold">Instituição / formulário</h2>
            <Field label="Instituição selecionada">
              <Select
                value={request.institutionId ?? ""}
                onChange={(e) => applyTemplateContext(e.target.value || null, request.healthInsurerId)}
              >
                <option value="">Selecione</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Template">
              <Select
                value={request.templateId ?? ""}
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  patch({
                    templateId: t?.id ?? null,
                    templateVersionId: t?.currentVersion?.id ?? null,
                  });
                }}
              >
                <option value="">Selecione o formulário original</option>
                {compatibleTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.currentVersion ? ` — v${t.currentVersion.version}` : " (sem PDF)"}
                  </option>
                ))}
              </Select>
            </Field>
            {selectedTemplate?.currentVersion ? (
              <p className="mt-3 rounded-lg bg-[#f1f5f9] px-3 py-2 text-[12px] text-[#475569]">
                Formulário: <strong className="text-[#0f172a]">{selectedTemplate.name} — Template v{selectedTemplate.currentVersion.version}</strong>
                {selectedInstitution ? ` • ${selectedInstitution.name}` : ""}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-[#b45309]">Faça o upload do PDF original no módulo Templates para preencher o documento da instituição.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-4 text-[14px] font-bold">Médico solicitante</h2>
            <Field label="Médico">
              <Select value={request.doctorId ?? ""} onChange={(e) => patch({ doctorId: e.target.value || null })}>
                <option value="">Selecione</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            {selectedDoctor ? (
              <div className="mt-4 flex flex-wrap gap-8 text-[13px]">
                <div>
                  <p className="text-[11px] text-[#64748b]">REGISTRO CRM</p>
                  <p className="font-semibold">CRM {selectedDoctor.crm} - {selectedDoctor.crmState}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748b]">RQE ESPECIALIDADE</p>
                  <p className="font-semibold">{selectedDoctor.rqe ? `RQE ${selectedDoctor.rqe}` : "—"} {selectedDoctor.specialty ? `(${selectedDoctor.specialty})` : ""}</p>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {step === 1 ? (
        <Card>
          <h2 className="mb-4 text-[14px] font-bold">Diagnóstico</h2>
          <Field label="Descrição clínica">
            <Textarea
              value={request.diagnosis ?? ""}
              onChange={(e) => patch({ diagnosis: e.target.value })}
              placeholder="Descreva o diagnóstico. Não invente CID — pesquise na base."
            />
          </Field>
          <Field label="CID">
            <Input
              value={cidQuery}
              placeholder="Pesquisar diagnóstico ou CID..."
              onChange={(e) => {
                const q = e.target.value;
                setCidQuery(q);
                if (q.trim().length < MIN_SEARCH_LENGTH) setCidResults([]);
              }}
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            {request.cids.map((cid) => (
              <span key={cid.codeSnapshot} className="flex items-center gap-2 rounded-full bg-[#eff6ff] px-3 py-1 text-[12px] text-[#1e5fa6]">
                CID {cid.codeSnapshot} — {cid.descriptionSnapshot}
                <button type="button" onClick={() => patch({ cids: request.cids.filter((c) => c.codeSnapshot !== cid.codeSnapshot) })}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <ul className="mt-2">
            {cidResults.map((cid) => (
              <li key={cid.id}>
                <button
                  type="button"
                  className="w-full px-2 py-1 text-left text-[13px] hover:bg-[#f8fafc]"
                  onClick={() => {
                    if (request.cids.some((c) => c.codeSnapshot === cid.code)) return;
                    patch({
                      cids: [
                        ...request.cids,
                        { id: crypto.randomUUID(), requestId: request.id, cidCodeId: cid.id, codeSnapshot: cid.code, descriptionSnapshot: cid.description, sortOrder: request.cids.length },
                      ],
                    });
                    setCidQuery("");
                    setCidResults([]);
                  }}
                >
                  <strong>{cid.code}</strong> — {cid.description}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <section aria-labelledby="clinical-context-title" className="rounded-xl border border-[#dbeafe] bg-[#f8fbff] px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p id="clinical-context-title" className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Contexto clínico</p>
                <p className="mt-1 text-[13px] text-[#0f172a]">
                  <span className="font-semibold">Diagnóstico:</span> {request.diagnosis?.trim() || "Não informado"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2" aria-label="CID selecionados">
                  {request.cids.length > 0 ? request.cids.map((cid) => (
                    <span key={cid.id} className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[11px] font-medium text-[#1e5fa6]">
                      CID {cid.codeSnapshot} — {cid.descriptionSnapshot}
                    </span>
                  )) : <span className="text-[12px] text-[#b45309]">Nenhum CID selecionado.</span>}
                </div>
              </div>
              <button type="button" className="text-[12px] font-semibold text-[#1e5fa6] hover:underline" onClick={() => setStep(1)}>
                Editar diagnóstico
              </button>
            </div>
          </section>
          <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold">Procedimentos solicitados</h2>
              <Badge tone="blue">{request.items.length} selecionados</Badge>
            </div>
            <Button variant="ghost" type="button" onClick={() => setShowKit(true)}>
              + Usar kit cirúrgico
            </Button>
          </div>
          <Input
            aria-label="Buscar procedimento, TUSS ou código IPASGO"
            value={procQuery}
            placeholder="Buscar procedimento, TUSS ou código IPASGO..."
            onChange={(e) => {
              const q = e.target.value;
              setProcQuery(q);
              if (q.trim().length < MIN_SEARCH_LENGTH) setProcResults([]);
            }}
          />
          {procResults.length > 0 ? (
            <ul className="mt-2 rounded-lg border border-[#e2e8f0]">
              {procResults.map((proc) => (
                <li key={proc.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#eff6ff]"
                    onClick={() => {
                      const resolutionDate = new Date();
                      const tuss = resolveProcedureCode(proc.codes, { procedureId: proc.id, codeSystem: "TUSS", at: resolutionDate, healthInsurerId: request.healthInsurerId });
                      const ipasgo = resolveProcedureCode(proc.codes, { procedureId: proc.id, codeSystem: "IPASGO", at: resolutionDate, healthInsurerId: request.healthInsurerId });
                      patch({
                        items: [
                          ...request.items,
                          {
                            id: crypto.randomUUID(),
                            requestId: request.id,
                            procedureId: proc.id,
                            procedureName: proc.name,
                            tussCodeId: tuss?.id ?? null,
                            ipasgoCodeId: ipasgo?.id ?? null,
                            tussCodeSnapshot: tuss?.code ?? null,
                            ipasgoCodeSnapshot: ipasgo?.code ?? null,
                            tussDescriptionSnapshot: tuss?.description ?? null,
                            ipasgoDescriptionSnapshot: ipasgo?.description ?? null,
                            tussVersionSnapshot: tuss?.version ?? null,
                            ipasgoVersionSnapshot: ipasgo?.version ?? null,
                            quantity: quantityForCodes(tuss, ipasgo),
                            laterality: null,
                            notes: null,
                            sortOrder: request.items.length,
                          },
                        ],
                      });
                      setProcQuery("");
                      setProcResults([]);
                    }}
                  >
                    {proc.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[11px] uppercase text-[#64748b]">
                <tr>
                  <th className="pb-2">Procedimento</th>
                  <th className="pb-2">TUSS</th>
                  <th className="pb-2">IPASGO</th>
                  <th className="pb-2">Quantidade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {request.items.map((item, index) => (
                  <tr key={item.id} className="border-t border-[#e2e8f0]">
                    <td className="py-3 font-semibold">{item.procedureName}</td>
                    <td className="py-3">{item.tussCodeSnapshot ?? <span className="text-[#b45309]">{CODE_NOT_FOUND}</span>}</td>
                    <td className="py-3">{item.ipasgoCodeSnapshot ?? <span className="text-[#b45309]">{CODE_NOT_FOUND}</span>}</td>
                    <td className="py-3">
                      <QuantityStepper
                        value={item.quantity}
                        onChange={(qty) => {
                          const next = [...request.items];
                          next[index] = { ...item, quantity: parseQuantity(qty) };
                          patch({ items: next });
                        }}
                      />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        className="text-[#dc2626]"
                        onClick={() => patch({ items: request.items.filter((i) => i.id !== item.id) })}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Card>
        </div>
      ) : null}

      {step === 3 ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon name="file-text" size={16} />
              <h2 className="text-[14px] font-bold">Justificativa clínica</h2>
            </div>
            <Button variant="ghost" type="button" onClick={() => setShowAi(true)}>
              <Icon name="sparkle" size={12} />
              Gerar justificativa
            </Button>
          </div>
          <Field label="Achados / exames / tratamentos prévios (opcional)">
            <Textarea
              value={request.clinicalNotes ?? ""}
              onChange={(e) => patch({ clinicalNotes: e.target.value })}
              placeholder="Informe apenas o que foi observado. O texto gerado não inventa dados."
            />
          </Field>
          <Field label="Justificativa">
            <Textarea
              value={request.clinicalJustification ?? ""}
              onChange={(e) => patch({ clinicalJustification: e.target.value })}
              className="min-h-[180px]"
              placeholder="Use o painel lateral para gerar uma justificativa técnica com base nos fatos informados. Nada é inventado."
            />
          </Field>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <h2 className="mb-4 text-[14px] font-bold">Revisão</h2>
          <dl className="grid grid-cols-1 gap-3 text-[13px] md:grid-cols-2">
            <div><dt className="text-[#64748b]">Paciente</dt><dd className="font-semibold">{selectedPatient?.fullName ?? "—"}</dd></div>
            <div><dt className="text-[#64748b]">Médico</dt><dd className="font-semibold">{selectedDoctor?.name ?? "—"}</dd></div>
            <div><dt className="text-[#64748b]">Instituição</dt><dd className="font-semibold">{selectedInstitution?.name ?? "—"}</dd></div>
            <div><dt className="text-[#64748b]">Template</dt><dd className="font-semibold">{selectedTemplate?.name ?? "—"}</dd></div>
            <div className="md:col-span-2"><dt className="text-[#64748b]">CID</dt><dd>{request.cids.map((c) => `${c.codeSnapshot} ${c.descriptionSnapshot}`).join("; ") || "—"}</dd></div>
            <div className="md:col-span-2"><dt className="text-[#64748b]">Diagnóstico</dt><dd>{request.diagnosis || "—"}</dd></div>
            <div className="md:col-span-2">
              <dt className="text-[#64748b]">Procedimentos</dt>
              <dd>
                <ul>
                  {request.items.map((i) => (
                    <li key={i.id}>{i.procedureName} — qtd {i.quantity} — TUSS {i.tussCodeSnapshot ?? CODE_NOT_FOUND}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="md:col-span-2"><dt className="text-[#64748b]">Justificativa</dt><dd className="whitespace-pre-wrap">{request.clinicalJustification || "—"}</dd></div>
          </dl>
          {request.status === "finalized" ? (
            <form action={duplicateRequestAction.bind(null, request.id)} className="mt-4">
              <Button type="submit" variant="secondary">Duplicar para nova versão</Button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
    <JustificationDrawer
      open={showAi}
      facts={{
        diagnosis: request.diagnosis ?? undefined,
        cids: request.cids.map((c) => ({ code: c.codeSnapshot, description: c.descriptionSnapshot })),
        procedures: request.items.map((i) => ({ name: i.procedureName, quantity: i.quantity })),
        indicationReason: request.clinicalNotes ?? undefined,
      }}
      onClose={() => setShowAi(false)}
      onApply={(text) => patch({ clinicalJustification: text })}
    />
    <KitPickerModal
      open={showKit}
      kits={kits}
      onClose={() => setShowKit(false)}
      onSelect={(kit) => {
        const missingProcedure = kit.items.find((item) => !kitProcedureById.has(item.procedureId));
        if (missingProcedure) {
          setSaveState("error");
          setSaveError(`O procedimento ${missingProcedure.procedureName} deste kit não está mais disponível.`);
          return;
        }
        const resolutionDate = new Date();
        const items = kit.items.map((item, index) => {
          const procedure = kitProcedureById.get(item.procedureId);
          if (!procedure) throw new Error("Procedimento do kit não localizado na base.");
          const tuss = resolveProcedureCode(procedure.codes, { procedureId: procedure.id, codeSystem: "TUSS", at: resolutionDate, healthInsurerId: request.healthInsurerId });
          const ipasgo = resolveProcedureCode(procedure.codes, { procedureId: procedure.id, codeSystem: "IPASGO", at: resolutionDate, healthInsurerId: request.healthInsurerId });
          return {
            id: crypto.randomUUID(),
            requestId: request.id,
            procedureId: procedure.id,
            procedureName: procedure.name,
            tussCodeId: tuss?.id ?? null,
            ipasgoCodeId: ipasgo?.id ?? null,
            tussCodeSnapshot: tuss?.code ?? null,
            ipasgoCodeSnapshot: ipasgo?.code ?? null,
            tussDescriptionSnapshot: tuss?.description ?? null,
            ipasgoDescriptionSnapshot: ipasgo?.description ?? null,
            tussVersionSnapshot: tuss?.version ?? null,
            ipasgoVersionSnapshot: ipasgo?.version ?? null,
            quantity: parseQuantity(item.defaultQuantity || quantityForCodes(tuss, ipasgo)),
            laterality: null,
            notes: item.notes,
            sortOrder: request.items.length + index,
          };
        });
        patch({ items: [...request.items, ...items] });
        setShowKit(false);
      }}
    />
    <GenerateConfirmModal
      open={showGenerate}
      request={request}
      patient={selectedPatient}
      doctor={selectedDoctor}
      institution={selectedInstitution}
      template={selectedTemplate}
      busy={busy}
      onClose={() => setShowGenerate(false)}
      onConfirm={(statement) => {
        setShowGenerate(false);
        void onGenerate(statement);
      }}
    />
    </div>
  );
}

function NewPatientForm({
  onCreated,
  insurers,
}: {
  onCreated: (p: Patient) => void;
  insurers: HealthInsurer[];
}) {
  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const created = await savePatientAction({
          fullName: String(form.get("fullName")),
          birthDate: String(form.get("birthDate") || "") || null,
          cpf: String(form.get("cpf") || "") || null,
          phone: String(form.get("phone") || "") || null,
          insuranceCard: String(form.get("insuranceCard") || "") || null,
          healthInsurerId: String(form.get("healthInsurerId") || "") || null,
        });
        onCreated(created);
      }}
    >
      <Field label="Nome completo"><Input name="fullName" required /></Field>
      <Field label="Nascimento"><Input name="birthDate" type="date" /></Field>
      <Field label="CPF"><Input name="cpf" /></Field>
      <Field label="Telefone"><Input name="phone" /></Field>
      <Field label="Carteirinha"><Input name="insuranceCard" /></Field>
      <Field label="Convênio">
        <Select name="healthInsurerId" defaultValue="">
          <option value="">Nenhum</option>
          {insurers.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Button type="submit">Salvar paciente</Button>
      </div>
    </form>
  );
}
