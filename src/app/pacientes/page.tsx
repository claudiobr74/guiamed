import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listPatientPage } from "@/lib/db/patient-page";
import { listInsurers } from "@/lib/db/repos";
import { maskCpfForList } from "@/lib/personal-data";
import { savePatientAction } from "@/app/actions";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requirePageUser();
  const { cursor } = await searchParams;
  const { patientPage, insurers } = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const [patientPage, insurers] = await Promise.all([
      listPatientPage(db, user.organizationId, { cursor, limit: 50 }),
      listInsurers(db, user.organizationId),
    ]);
    return { patientPage, insurers };
  });
  const patients = patientPage.items;
  return (
    <AppShell user={user} title="Pacientes">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {patients.length === 0 && !cursor ? (
          <EmptyState
            title="Nenhum paciente cadastrado"
            description="Cadastre seus pacientes para agilizar o preenchimento de novas guias de procedimento cirúrgico."
            icon="empty-user"
          />
        ) : (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#64748b]">Exibindo até 50 pacientes por página. Clique no nome para editar.</p>
              {cursor ? <Link href="/pacientes" className="text-[12px] font-semibold text-[#1e5fa6]">Voltar ao início</Link> : null}
            </div>
            {patients.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais pacientes nesta paginação.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[13px]">
                  <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Nome</th><th className="pb-2">CPF</th><th className="pb-2">Convênio</th><th className="pb-2">Carteirinha</th></tr></thead>
                  <tbody>
                    {patients.map((p) => (
                      <tr key={p.id} className="border-t border-[#e2e8f0]">
                        <td className="py-2 font-semibold"><Link href={`/pacientes/${p.id}`} className="text-[#1e5fa6] hover:underline">{p.fullName}</Link></td>
                        <td>{maskCpfForList(p.cpf)}</td>
                        <td>{p.healthInsurerName ?? "—"}</td>
                        <td>{p.insuranceCard ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {patientPage.nextCursor ? (
              <div className="mt-4 flex justify-end border-t border-[#e2e8f0] pt-4">
                <Link
                  href={`/pacientes?cursor=${encodeURIComponent(patientPage.nextCursor)}`}
                  className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
                >
                  Próximos 50
                </Link>
              </div>
            ) : null}
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
                sex: (String(formData.get("sex") || "") || null) as "F" | "M" | "I" | null,
                phone: String(formData.get("phone") || "") || null,
                email: String(formData.get("email") || "") || null,
                insuranceCard: String(formData.get("insuranceCard") || "") || null,
                healthInsurerId: String(formData.get("healthInsurerId") || "") || null,
              });
            }}
            className="flex flex-col gap-3"
          >
            <Field label="Nome completo"><Input name="fullName" required /></Field>
            <Field label="Nascimento"><Input name="birthDate" type="date" /></Field>
            <Field label="Sexo">
              <Select name="sex" defaultValue="">
                <option value="">Não informado</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
                <option value="I">Indeterminado / outro registro</option>
              </Select>
            </Field>
            <Field label="CPF"><Input name="cpf" inputMode="numeric" /></Field>
            <Field label="Telefone"><Input name="phone" inputMode="tel" /></Field>
            <Field label="E-mail"><Input name="email" type="email" /></Field>
            <Field label="Carteirinha"><Input name="insuranceCard" /></Field>
            <Field label="Convênio">
              <Select name="healthInsurerId" defaultValue="">
                <option value="">Nenhum</option>
                {insurers.filter((insurer) => insurer.active).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
            <Button type="submit">Cadastrar</Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
