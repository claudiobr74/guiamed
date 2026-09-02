import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listDoctors } from "@/lib/db/repos";
import { saveDoctorAction } from "@/app/actions";
import Link from "next/link";

export default async function MedicosPage() {
  const user = await requirePageAdmin();
  const doctors = await withOrganizationContext(user.organizationId, user.id, (db) => listDoctors(db, user.organizationId));
  return (
    <AppShell user={user} title="Médicos">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {doctors.length === 0 ? (
          <EmptyState title="Nenhum médico" description="Cadastre o médico solicitante padrão da clínica." />
        ) : (
          <Card>
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Nome</th><th className="pb-2">CRM</th><th className="pb-2">Especialidade</th></tr></thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id} className="border-t border-[#e2e8f0]">
                    <td className="py-2 font-semibold"><Link href={`/medicos/${d.id}`} className="text-[#1e5fa6]">{d.name}</Link> {d.isDefault ? "• padrão" : ""}</td>
                    <td>{d.crm}-{d.crmState}</td>
                    <td>{d.specialty ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <Card>
          <h2 className="mb-3 text-[14px] font-bold">Novo médico</h2>
          <form
            action={async (formData) => {
              "use server";
              await saveDoctorAction({
                name: String(formData.get("name")),
                crm: String(formData.get("crm")),
                crmState: String(formData.get("crmState") || "GO"),
                specialty: String(formData.get("specialty") || "") || null,
                rqe: String(formData.get("rqe") || "") || null,
                isDefault: formData.get("isDefault") === "on",
              });
            }}
            className="flex flex-col gap-3"
          >
            <Field label="Nome"><Input name="name" required /></Field>
            <Field label="CRM"><Input name="crm" required /></Field>
            <Field label="UF"><Input name="crmState" defaultValue="GO" required /></Field>
            <Field label="Especialidade"><Input name="specialty" /></Field>
            <Field label="RQE"><Input name="rqe" /></Field>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="isDefault" /> Médico padrão</label>
            <Button type="submit">Cadastrar</Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
