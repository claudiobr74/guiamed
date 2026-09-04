import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Field, Input } from "@/components/ui";
import { saveDoctorAction } from "@/features/doctors/profile-actions";
import { SignatureUploader } from "@/features/doctors/SignatureUploader";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getDoctor } from "@/lib/db/repos";
import { notFound } from "next/navigation";

export default async function MedicoPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAdmin();
  const { id } = await params;
  const doctor = await withOrganizationContext(user.organizationId, user.id, (db) => getDoctor(db, user.organizationId, id));
  if (!doctor) notFound();
  return (
    <AppShell user={user} title="Perfil do médico">
      <div className="grid max-w-4xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <form
            action={async (formData) => {
              "use server";
              await saveDoctorAction({
                id,
                name: String(formData.get("name")),
                crm: String(formData.get("crm")),
                crmState: String(formData.get("crmState")),
                specialty: String(formData.get("specialty") || "") || null,
                rqe: String(formData.get("rqe") || "") || null,
                phone: String(formData.get("phone") || "") || null,
                email: String(formData.get("email") || "") || null,
                isDefault: formData.get("isDefault") === "on",
                active: formData.get("active") === "on",
              });
            }}
            className="flex flex-col gap-3"
          >
            <Field label="Nome"><Input name="name" defaultValue={doctor.name} required /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="CRM"><Input name="crm" defaultValue={doctor.crm} required /></Field>
              <Field label="UF"><Input name="crmState" defaultValue={doctor.crmState} maxLength={2} required /></Field>
            </div>
            <Field label="Especialidade"><Input name="specialty" defaultValue={doctor.specialty ?? ""} /></Field>
            <Field label="RQE"><Input name="rqe" defaultValue={doctor.rqe ?? ""} /></Field>
            <Field label="Telefone"><Input name="phone" defaultValue={doctor.phone ?? ""} /></Field>
            <Field label="E-mail"><Input name="email" type="email" defaultValue={doctor.email ?? ""} /></Field>
            <div className="flex flex-wrap gap-5 text-[13px]">
              <label className="flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={doctor.isDefault} /> Médico padrão</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={doctor.active} /> Médico ativo</label>
            </div>
            <Button type="submit">Salvar perfil</Button>
          </form>
        </Card>

        <SignatureUploader doctorId={id} hasSignature={Boolean(doctor.signatureFile)} />
      </div>
    </AppShell>
  );
}
