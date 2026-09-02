import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Field, Input } from "@/components/ui";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getDoctor } from "@/lib/db/repos";
import { saveDoctorAction } from "@/app/actions";
import { notFound } from "next/navigation";

export default async function MedicoPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAdmin();
  const { id } = await params;
  const doctor = await withOrganizationContext(user.organizationId, user.id, (db) => getDoctor(db, user.organizationId, id));
  if (!doctor) notFound();
  return (
    <AppShell user={user} title="Perfil do médico">
      <Card className="max-w-xl">
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
              active: true,
            });
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Nome"><Input name="name" defaultValue={doctor.name} required /></Field>
          <Field label="CRM"><Input name="crm" defaultValue={doctor.crm} required /></Field>
          <Field label="UF"><Input name="crmState" defaultValue={doctor.crmState} required /></Field>
          <Field label="Especialidade"><Input name="specialty" defaultValue={doctor.specialty ?? ""} /></Field>
          <Field label="RQE"><Input name="rqe" defaultValue={doctor.rqe ?? ""} /></Field>
          <Field label="Telefone"><Input name="phone" defaultValue={doctor.phone ?? ""} /></Field>
          <Field label="E-mail"><Input name="email" defaultValue={doctor.email ?? ""} /></Field>
          <p className="text-[12px] text-[#475569]">
            A imagem de assinatura é apenas uma reprodução visual no PDF. Não equivale a assinatura digital ICP-Brasil.
          </p>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="isDefault" defaultChecked={doctor.isDefault} /> Médico padrão</label>
          <Button type="submit">Salvar</Button>
        </form>
      </Card>
    </AppShell>
  );
}
