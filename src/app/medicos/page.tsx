import Link from "next/link";
import { PencilLine } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { saveDoctorAction } from "@/features/doctors/profile-actions";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listDoctorsPage } from "@/lib/db/admin-page";

export default async function MedicosPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requirePageAdmin();
  const { cursor } = await searchParams;
  const page = await withOrganizationContext(user.organizationId, user.id, (db) =>
    listDoctorsPage(db, user.organizationId, { cursor, limit: 50 }),
  );
  const doctors = page.items;

  return (
    <AppShell
      user={user}
      title="Médicos"
      actions={
        <details className="group relative">
          <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#184e89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e5fa6] focus-visible:ring-offset-2">
            + Novo médico
          </summary>
          <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[min(400px,calc(100vw-32px))] rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-[15px] font-bold text-[#0f172a]">Novo médico</h2>
            <p className="mb-4 text-[11px] text-[#64748b]">Cadastre as credenciais usadas nas solicitações e assinaturas.</p>
            <DoctorForm />
          </div>
        </details>
      }
    >
      {doctors.length === 0 && !cursor ? (
        <EmptyState title="Nenhum médico" description="Cadastre o médico solicitante padrão da clínica." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <p className="text-[12px] text-[#64748b]">Exibindo até 50 médicos por página, em ordem alfabética.</p>
            {cursor ? <Link href="/medicos" className="text-[12px] font-semibold text-[#1e5fa6] hover:underline">Voltar ao início</Link> : null}
          </div>
          {doctors.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais médicos nesta paginação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[12px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#475569]">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">CRM</th>
                    <th className="px-4 py-3">UF</th>
                    <th className="px-4 py-3">RQE</th>
                    <th className="px-4 py-3">Especialidade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor) => (
                    <tr key={doctor.id} className="border-t border-[#e2e8f0]">
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">
                        {doctor.name}
                        {doctor.isDefault ? <span className="ml-2"><Badge tone="blue">Padrão</Badge></span> : null}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{doctor.crm}</td>
                      <td className="px-4 py-3 text-[#475569]">{doctor.crmState || "—"}</td>
                      <td className="px-4 py-3 text-[#475569]">{doctor.rqe ?? "—"}</td>
                      <td className="px-4 py-3 text-[#475569]">{doctor.specialty ?? "—"}</td>
                      <td className="px-4 py-3"><Badge tone={doctor.active ? "green" : "neutral"}>{doctor.active ? "Ativo" : "Inativo"}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/medicos/${doctor.id}`}
                          className="inline-flex size-8 items-center justify-center rounded-md text-[#475569] hover:bg-[#eff6ff] hover:text-[#1e5fa6]"
                          aria-label={`Editar médico ${doctor.name}`}
                          title="Editar médico"
                        >
                          <PencilLine size={16} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {page.nextCursor ? (
            <div className="flex justify-end border-t border-[#e2e8f0] p-4">
              <Link
                href={`/medicos?cursor=${encodeURIComponent(page.nextCursor)}`}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
              >
                Próximos 50
              </Link>
            </div>
          ) : null}
        </Card>
      )}
    </AppShell>
  );
}

function DoctorForm() {
  return (
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
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <div className="sm:col-span-2"><Field label="Nome"><Input name="name" required /></Field></div>
      <Field label="CRM"><Input name="crm" required /></Field>
      <Field label="UF"><Input name="crmState" defaultValue="GO" maxLength={2} required /></Field>
      <div className="sm:col-span-2"><Field label="Especialidade"><Input name="specialty" /></Field></div>
      <Field label="RQE"><Input name="rqe" /></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-[13px]"><input type="checkbox" name="isDefault" /> Médico padrão</label>
      <div className="sm:col-span-2 flex justify-end"><Button type="submit">Cadastrar médico</Button></div>
    </form>
  );
}
