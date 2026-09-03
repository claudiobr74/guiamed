import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listDoctorsPage } from "@/lib/db/admin-page";
import { saveDoctorAction } from "@/app/actions";

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
    <AppShell user={user} title="Médicos">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {doctors.length === 0 && !cursor ? (
          <EmptyState title="Nenhum médico" description="Cadastre o médico solicitante padrão da clínica." />
        ) : (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#64748b]">Exibindo até 50 médicos por página, em ordem alfabética.</p>
              {cursor ? (
                <Link href="/medicos" className="text-[12px] font-semibold text-[#1e5fa6]">
                  Voltar ao início
                </Link>
              ) : null}
            </div>
            {doctors.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais médicos nesta paginação.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Nome</th><th className="pb-2">CRM</th><th className="pb-2">Especialidade</th></tr></thead>
                  <tbody>
                    {doctors.map((d) => (
                      <tr key={d.id} className="border-t border-[#e2e8f0]">
                        <td className="py-2 font-semibold"><Link href={`/medicos/${d.id}`} className="text-[#1e5fa6]">{d.name}</Link> {d.isDefault ? "• padrão" : ""}{d.active ? "" : " • inativo"}</td>
                        <td>{d.crm}-{d.crmState}</td>
                        <td>{d.specialty ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {page.nextCursor ? (
              <div className="mt-4 flex justify-end border-t border-[#e2e8f0] pt-4">
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
