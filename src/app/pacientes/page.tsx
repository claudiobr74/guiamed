import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listInsurers, listPatients } from "@/lib/db/repos";
import { savePatientAction } from "@/app/actions";

export default async function PacientesPage() {
  const user = await requirePageUser();
  const { patients, insurers } = await withOrganizationContext(user.organizationId, user.id, async (db) => ({
    patients: await listPatients(db, user.organizationId),
    insurers: await listInsurers(db, user.organizationId),
  }));
  return (
    <AppShell user={user} title="Pacientes">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {patients.length === 0 ? (
          <EmptyState
            title="Nenhum paciente cadastrado"
            description="Cadastre seus pacientes para agilizar o preenchimento de novas guias de procedimento cirúrgico."
            icon="empty-user"
          />
        ) : (
          <Card>
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Nome</th><th className="pb-2">CPF</th><th className="pb-2">Convênio</th></tr></thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="border-t border-[#e2e8f0]">
                    <td className="py-2 font-semibold">{p.fullName}</td>
                    <td>{p.cpf ?? "—"}</td>
                    <td>{p.healthInsurerName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <Card>
          <h2 className="mb-3 text-[14px] font-bold">Novo paciente</h2>
          <form
            action={async (formData) => {
              "use server";
              await savePatientAction({
                fullName: String(formData.get("fullName")),
                birthDate: String(formData.get("birthDate") || "") || null,
                cpf: String(formData.get("cpf") || "") || null,
                phone: String(formData.get("phone") || "") || null,
                insuranceCard: String(formData.get("insuranceCard") || "") || null,
                healthInsurerId: String(formData.get("healthInsurerId") || "") || null,
              });
            }}
            className="flex flex-col gap-3"
          >
            <Field label="Nome completo"><Input name="fullName" required /></Field>
            <Field label="Nascimento"><Input name="birthDate" type="date" /></Field>
            <Field label="CPF"><Input name="cpf" /></Field>
            <Field label="Telefone"><Input name="phone" /></Field>
            <Field label="Carteirinha"><Input name="insuranceCard" /></Field>
            <Field label="Convênio">
              <Select name="healthInsurerId" defaultValue="">
                <option value="">Nenhum</option>
                {insurers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
            <Button type="submit">Cadastrar</Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
