import Link from "next/link";
import { PencilLine } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { saveInstitutionAction, saveInsurerAction } from "@/features/admin/actions";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listInstitutionsPage, listInsurersPage } from "@/lib/db/admin-page";
import type { HealthInsurer, Institution, InstitutionKind } from "@/types/domain";

const KIND_LABEL: Record<InstitutionKind, string> = {
  hospital: "Hospital",
  clinic: "Clínica",
  operator: "Operadora",
  insurer: "Seguradora/convênio",
};

function pageHref(input: { institutionCursor?: string | null; insurerCursor?: string | null }): string {
  const params = new URLSearchParams();
  if (input.institutionCursor) params.set("institutionCursor", input.institutionCursor);
  if (input.insurerCursor) params.set("insurerCursor", input.insurerCursor);
  const query = params.toString();
  return query ? `/instituicoes?${query}` : "/instituicoes";
}

export default async function InstituicoesPage({
  searchParams,
}: {
  searchParams: Promise<{ institutionCursor?: string; insurerCursor?: string }>;
}) {
  const user = await requirePageAdmin();
  const { institutionCursor, insurerCursor } = await searchParams;
  const { institutionPage, insurerPage } = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const [institutionPage, insurerPage] = await Promise.all([
      listInstitutionsPage(db, user.organizationId, { cursor: institutionCursor, limit: 50 }),
      listInsurersPage(db, user.organizationId, { cursor: insurerCursor, limit: 50 }),
    ]);
    return { institutionPage, insurerPage };
  });
  const institutions = institutionPage.items;
  const insurers = insurerPage.items;

  return (
    <AppShell user={user} title="Instituições">
      <div className="flex flex-col gap-8">
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a]">Hospitais e clínicas</h2>
              <p className="mt-1 text-[12px] text-[#64748b]">Instituições onde os procedimentos são realizados e às quais os templates podem ser vinculados.</p>
            </div>
            <CreateInstitutionPanel />
          </div>

          {institutions.length === 0 && !institutionCursor ? (
            <EmptyState
              title="Nenhuma instituição"
              description="Cadastre hospital ou clínica separadamente do convênio/operadora."
            />
          ) : institutions.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais instituições nesta paginação.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {institutions.map((institution) => (
                <InstitutionCard key={institution.id} institution={institution} />
              ))}
            </div>
          )}

          <PaginationFooter
            currentCursor={institutionCursor}
            nextCursor={institutionPage.nextCursor}
            initialHref={pageHref({ insurerCursor })}
            nextHref={institutionPage.nextCursor ? pageHref({ institutionCursor: institutionPage.nextCursor, insurerCursor }) : null}
            label="instituições"
          />
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a]">Convênios e operadoras</h2>
              <p className="mt-1 text-[12px] text-[#64748b]">Operadoras usadas para carteirinha, regras de códigos e seleção dos formulários compatíveis.</p>
            </div>
            <CreateInsurerPanel />
          </div>

          {insurers.length === 0 && !insurerCursor ? (
            <EmptyState title="Nenhum convênio" description="Cadastre a operadora de saúde sem misturá-la ao cadastro do hospital ou clínica." />
          ) : insurers.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais convênios nesta paginação.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {insurers.map((insurer) => (
                <InsurerCard key={insurer.id} insurer={insurer} />
              ))}
            </div>
          )}

          <PaginationFooter
            currentCursor={insurerCursor}
            nextCursor={insurerPage.nextCursor}
            initialHref={pageHref({ institutionCursor })}
            nextHref={insurerPage.nextCursor ? pageHref({ institutionCursor, insurerCursor: insurerPage.nextCursor }) : null}
            label="convênios"
          />
        </section>
      </div>
    </AppShell>
  );
}

function InstitutionCard({ institution }: { institution: Institution }) {
  return (
    <details className="group rounded-xl border border-[#e2e8f0] bg-white p-4 open:shadow-md">
      <summary className="cursor-pointer list-none focus-visible:outline-none">
        <div className="flex min-h-[116px] flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[14px] font-bold text-[#0f172a]">{institution.name}</h3>
              <Badge tone={institution.active ? "green" : "neutral"}>{institution.active ? "Ativa" : "Inativa"}</Badge>
            </div>
            <div className="mt-2"><Badge tone="neutral">{KIND_LABEL[institution.kind]}</Badge></div>
            {(institution.city || institution.state) ? (
              <p className="mt-2 text-[11px] text-[#64748b]">{[institution.city, institution.state].filter(Boolean).join(" / ")}</p>
            ) : null}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-3">
            <p className="text-[11px] text-[#64748b]">{institution.cnpj ? `CNPJ ${institution.cnpj}` : "Sem CNPJ informado"}</p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1e5fa6]">
              Editar <PencilLine size={13} aria-hidden="true" />
            </span>
          </div>
        </div>
      </summary>
      <div className="mt-4 border-t border-[#e2e8f0] pt-4">
        <InstitutionForm institution={institution} />
      </div>
    </details>
  );
}

function InsurerCard({ insurer }: { insurer: HealthInsurer }) {
  return (
    <details className="group rounded-xl border border-[#e2e8f0] bg-white p-4 open:shadow-md">
      <summary className="cursor-pointer list-none focus-visible:outline-none">
        <div className="flex min-h-[116px] flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[14px] font-bold text-[#0f172a]">{insurer.name}</h3>
              <Badge tone={insurer.active ? "green" : "neutral"}>{insurer.active ? "Ativo" : "Inativo"}</Badge>
            </div>
            <div className="mt-2"><Badge tone="blue">Convênio</Badge></div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-3">
            <p className="text-[11px] text-[#64748b]">{insurer.code ? `Código ${insurer.code}` : "Sem código interno"}</p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1e5fa6]">
              Editar <PencilLine size={13} aria-hidden="true" />
            </span>
          </div>
        </div>
      </summary>
      <div className="mt-4 border-t border-[#e2e8f0] pt-4">
        <InsurerForm insurer={insurer} />
      </div>
    </details>
  );
}

function CreateInstitutionPanel() {
  return (
    <details className="group relative shrink-0">
      <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#184e89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e5fa6] focus-visible:ring-offset-2">
        + Nova instituição
      </summary>
      <div className="mt-3 w-full rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl sm:absolute sm:right-0 sm:z-20 sm:w-[480px]">
        <h3 className="mb-3 text-[14px] font-bold">Nova instituição</h3>
        <InstitutionForm />
      </div>
    </details>
  );
}

function CreateInsurerPanel() {
  return (
    <details className="group relative shrink-0">
      <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2.5 text-[13px] font-semibold text-[#1e5fa6] hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e5fa6] focus-visible:ring-offset-2">
        + Novo convênio
      </summary>
      <div className="mt-3 w-full rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl sm:absolute sm:right-0 sm:z-20 sm:w-[400px]">
        <h3 className="mb-3 text-[14px] font-bold">Novo convênio / operadora</h3>
        <InsurerForm />
      </div>
    </details>
  );
}

function PaginationFooter({
  currentCursor,
  nextCursor,
  initialHref,
  nextHref,
  label,
}: {
  currentCursor?: string;
  nextCursor: string | null;
  initialHref: string;
  nextHref: string | null;
  label: string;
}) {
  if (!currentCursor && !nextCursor) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
      {currentCursor ? <Link href={initialHref} className="text-[12px] font-semibold text-[#64748b] hover:text-[#1e5fa6]">Voltar ao início</Link> : null}
      {nextHref ? (
        <Link href={nextHref} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]">
          Próximos 50 {label}
        </Link>
      ) : null}
    </div>
  );
}

function InstitutionForm({ institution }: { institution?: Institution }) {
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

function InsurerForm({ insurer }: { insurer?: HealthInsurer }) {
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
