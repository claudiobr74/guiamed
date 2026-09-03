import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listInstitutions, listInsurers } from "@/lib/db/repos";
import { saveInstitutionAction, saveInsurerAction } from "@/app/actions";
import type { InstitutionKind } from "@/types/domain";

const KIND_LABEL: Record<InstitutionKind, string> = {
  hospital: "Hospital",
  clinic: "Clínica",
  operator: "Operadora",
  insurer: "Seguradora/convênio",
};

export default async function InstituicoesPage() {
  const user = await requirePageAdmin();
  const { institutions, insurers } = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const [institutions, insurers] = await Promise.all([
      listInstitutions(db, user.organizationId),
      listInsurers(db, user.organizationId),
    ]);
    return { institutions, insurers };
  });

  return (
    <AppShell user={user} title="Instituições e convênios">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Nova instituição</h2>
            <InstitutionForm />
          </Card>
          {institutions.length === 0 ? (
            <EmptyState title="Nenhuma instituição" description="Cadastre hospital ou clínica separadamente do convênio/operadora." />
          ) : (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-bold">Hospitais, clínicas e instituições</h2>
                <span className="text-[11px] text-[#64748b]">{institutions.length} cadastro(s)</span>
              </div>
              <div className="space-y-2">
                {institutions.map((institution) => (
                  <details key={institution.id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <summary className="cursor-pointer list-none text-[13px] font-semibold">
                      <span>{institution.name}</span>
                      <span className="ml-2 text-[11px] font-normal text-[#64748b]">
                        {KIND_LABEL[institution.kind]} • {institution.active ? "ativo" : "inativo"}
                      </span>
                    </summary>
                    <div className="mt-3 border-t border-[#e2e8f0] pt-3">
                      <InstitutionForm institution={institution} />
                    </div>
                  </details>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Novo convênio / operadora</h2>
            <InsurerForm />
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold">Convênios / operadoras de saúde</h2>
              <span className="text-[11px] text-[#64748b]">{insurers.length} cadastro(s)</span>
            </div>
            {insurers.length === 0 ? (
              <p className="text-[13px] text-[#475569]">Nenhuma operadora cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {insurers.map((insurer) => (
                  <details key={insurer.id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <summary className="cursor-pointer list-none text-[13px] font-semibold">
                      {insurer.name}
                      <span className="ml-2 text-[11px] font-normal text-[#64748b]">
                        {insurer.code ? `cód. ${insurer.code} • ` : ""}{insurer.active ? "ativo" : "inativo"}
                      </span>
                    </summary>
                    <div className="mt-3 border-t border-[#e2e8f0] pt-3">
                      <InsurerForm insurer={insurer} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function InstitutionForm({ institution }: { institution?: Awaited<ReturnType<typeof listInstitutions>>[number] }) {
  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      action={async (formData) => {
        "use server";
        await saveInstitutionAction({
          id: String(formData.get("id") || "") || undefined,
          name: String(formData.get("name")),
          kind: String(formData.get("kind")) as InstitutionKind,
          city: String(formData.get("city") || "") || null,
          state: String(formData.get("state") || "") || null,
          cnpj: String(formData.get("cnpj") || "") || null,
          phone: String(formData.get("phone") || "") || null,
          active: formData.get("active") === "on",
        });
      }}
    >
      {institution ? <input type="hidden" name="id" value={institution.id} /> : null}
      <div className="sm:col-span-2"><Field label="Nome"><Input name="name" defaultValue={institution?.name ?? ""} required /></Field></div>
      <Field label="Tipo">
        <Select name="kind" defaultValue={institution?.kind ?? "hospital"}>
          <option value="hospital">Hospital</option>
          <option value="clinic">Clínica</option>
          <option value="operator">Operadora</option>
          <option value="insurer">Seguradora/convênio</option>
        </Select>
      </Field>
      <Field label="CNPJ"><Input name="cnpj" inputMode="numeric" defaultValue={institution?.cnpj ?? ""} placeholder="00.000.000/0000-00" /></Field>
      <Field label="Cidade"><Input name="city" defaultValue={institution?.city ?? ""} /></Field>
      <Field label="UF"><Input name="state" maxLength={2} defaultValue={institution?.state ?? ""} placeholder="GO" /></Field>
      <Field label="Telefone"><Input name="phone" inputMode="tel" defaultValue={institution?.phone ?? ""} /></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-[13px]">
        <input type="checkbox" name="active" defaultChecked={institution?.active ?? true} /> Ativa
      </label>
      <div className="sm:col-span-2"><Button type="submit">{institution ? "Salvar alterações" : "Cadastrar instituição"}</Button></div>
    </form>
  );
}

function InsurerForm({ insurer }: { insurer?: Awaited<ReturnType<typeof listInsurers>>[number] }) {
  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        "use server";
        await saveInsurerAction({
          id: String(formData.get("id") || "") || undefined,
          name: String(formData.get("name")),
          code: String(formData.get("code") || "") || null,
          active: formData.get("active") === "on",
        });
      }}
    >
      {insurer ? <input type="hidden" name="id" value={insurer.id} /> : null}
      <Field label="Nome"><Input name="name" defaultValue={insurer?.name ?? ""} required placeholder="IPASGO" /></Field>
      <Field label="Código interno"><Input name="code" defaultValue={insurer?.code ?? ""} /></Field>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked={insurer?.active ?? true} /> Ativo</label>
      <Button type="submit">{insurer ? "Salvar alterações" : "Cadastrar convênio"}</Button>
    </form>
  );
}
