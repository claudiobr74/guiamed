import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { savePatientAction } from "@/app/actions";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getPatient, listInsurers } from "@/lib/db/repos";

export default async function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const { patient, insurers } = await withOrganizationContext(user.organizationId, user.id, async (db) => ({
    patient: await getPatient(db, user.organizationId, id),
    insurers: await listInsurers(db, user.organizationId),
  }));
  if (!patient) notFound();

  return (
    <AppShell user={user} title="Editar paciente">
      <Card className="max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#0f172a]">Dados do paciente</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">Atualize apenas dados administrativos confirmados. As guias já finalizadas preservam o snapshot histórico.</p>
          </div>
          <Link href="/pacientes" className="text-[12px] font-semibold text-[#1e5fa6]">Voltar</Link>
        </div>
        <form
          action={async (formData) => {
            "use server";
            await savePatientAction({
              id,
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
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <div className="md:col-span-2"><Field label="Nome completo"><Input name="fullName" defaultValue={patient.fullName} required /></Field></div>
          <Field label="Nascimento"><Input name="birthDate" type="date" defaultValue={patient.birthDate ?? ""} /></Field>
          <Field label="Sexo">
            <Select name="sex" defaultValue={patient.sex ?? ""}>
              <option value="">Não informado</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="I">Indeterminado / outro registro</option>
            </Select>
          </Field>
          <Field label="CPF"><Input name="cpf" defaultValue={patient.cpf ?? ""} inputMode="numeric" /></Field>
          <Field label="Telefone"><Input name="phone" defaultValue={patient.phone ?? ""} inputMode="tel" /></Field>
          <Field label="E-mail"><Input name="email" type="email" defaultValue={patient.email ?? ""} /></Field>
          <Field label="Carteirinha"><Input name="insuranceCard" defaultValue={patient.insuranceCard ?? ""} /></Field>
          <div className="md:col-span-2">
            <Field label="Convênio">
              <Select name="healthInsurerId" defaultValue={patient.healthInsurerId ?? ""}>
                <option value="">Nenhum</option>
                {insurers.filter((insurer) => insurer.active || insurer.id === patient.healthInsurerId).map((insurer) => (
                  <option key={insurer.id} value={insurer.id}>{insurer.name}{insurer.active ? "" : " (inativo)"}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="md:col-span-2 flex justify-end pt-2"><Button type="submit">Salvar alterações</Button></div>
        </form>
      </Card>
    </AppShell>
  );
}
