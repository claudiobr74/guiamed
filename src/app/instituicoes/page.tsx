import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageAdmin } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { listInstitutions, listInsurers } from "@/lib/db/repos";
import { saveInstitutionAction, saveInsurerAction } from "@/app/actions";
import type { InstitutionKind } from "@/types/domain";

export default async function InstituicoesPage() {
  const user = await requirePageAdmin();
  const { institutions, insurers } = await withRls(user.organizationId, user.id, async (db) => ({
    institutions: await listInstitutions(db, user.organizationId),
    insurers: await listInsurers(db, user.organizationId),
  }));
  return (
    <AppShell user={user} title="Instituições e operadoras">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-[14px] font-bold">Hospitais, clínicas e operadoras</h2>
          {institutions.length === 0 ? (
            <EmptyState title="Nenhuma instituição" description="Separe hospital, clínica, operadora e convênio." />
          ) : (
            <ul className="text-[13px]">
              {institutions.map((i) => (
                <li key={i.id} className="border-t border-[#e2e8f0] py-2">
                  <strong>{i.name}</strong> — {i.kind}
                </li>
              ))}
            </ul>
          )}
          {user.role === "admin" ? (
            <form
              className="mt-4 flex flex-col gap-3"
              action={async (formData) => {
                "use server";
                await saveInstitutionAction({
                  name: String(formData.get("name")),
                  kind: String(formData.get("kind")) as InstitutionKind,
                });
              }}
            >
              <Field label="Nome"><Input name="name" required /></Field>
              <Field label="Tipo">
                <Select name="kind" defaultValue="hospital">
                  <option value="hospital">Hospital</option>
                  <option value="clinic">Clínica</option>
                  <option value="operator">Operadora</option>
                  <option value="insurer">Convênio</option>
                </Select>
              </Field>
              <Button type="submit">Cadastrar instituição</Button>
            </form>
          ) : null}
        </Card>
        <Card>
          <h2 className="mb-3 text-[14px] font-bold">Convênios / operadoras de saúde</h2>
          {insurers.length === 0 ? <p className="text-[13px] text-[#475569]">Nenhuma operadora cadastrada.</p> : (
            <ul className="text-[13px]">{insurers.map((i) => <li key={i.id} className="border-t border-[#e2e8f0] py-2">{i.name}</li>)}</ul>
          )}
          {user.role === "admin" ? (
            <form
              className="mt-4 flex flex-col gap-3"
              action={async (formData) => {
                "use server";
                await saveInsurerAction({ name: String(formData.get("name")), code: String(formData.get("code") || "") || undefined });
              }}
            >
              <Field label="Nome"><Input name="name" required placeholder="IPASGO" /></Field>
              <Field label="Código interno"><Input name="code" /></Field>
              <Button type="submit">Cadastrar operadora</Button>
            </form>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
