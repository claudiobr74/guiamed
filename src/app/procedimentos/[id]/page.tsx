import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { saveProcedureAction } from "@/features/admin/actions";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getProcedureAdmin } from "@/lib/db/procedure-admin";

export default async function ProcedimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAdmin();
  const { id } = await params;
  const procedure = await withOrganizationContext(user.organizationId, user.id, (db) =>
    getProcedureAdmin(db, user.organizationId, id),
  );
  if (!procedure) notFound();

  return (
    <AppShell user={user} title="Editar procedimento">
      <div className="flex max-w-5xl flex-col gap-5">
        <div><Link href="/procedimentos" className="text-[12px] font-semibold text-[#1e5fa6]">← Voltar para procedimentos</Link></div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <h2 className="mb-3 text-[15px] font-bold">Dados canônicos</h2>
            <form
              action={async (formData) => {
                "use server";
                await saveProcedureAction({
                  id,
                  name: String(formData.get("name")),
                  description: String(formData.get("description") || "") || null,
                  specialty: String(formData.get("specialty") || "") || null,
                  category: String(formData.get("category") || "") || null,
                  synonyms: String(formData.get("synonyms") || "").split(",").map((value) => value.trim()).filter(Boolean),
                  active: formData.get("active") === "on",
                });
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Nome canônico"><Input name="name" defaultValue={procedure.name} required /></Field>
              <Field label="Descrição"><Textarea name="description" defaultValue={procedure.description ?? ""} className="min-h-24" /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Especialidade"><Input name="specialty" defaultValue={procedure.specialty ?? ""} /></Field>
                <Field label="Categoria"><Input name="category" defaultValue={procedure.category ?? ""} /></Field>
              </div>
              <Field label="Sinônimos (separados por vírgula)"><Input name="synonyms" defaultValue={procedure.synonyms.join(", ")} /></Field>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked={procedure.active} /> Procedimento ativo</label>
              <Button type="submit">Salvar procedimento</Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-bold">Códigos associados</h2>
            {procedure.codes.length === 0 ? (
              <p className="text-[13px] text-[#64748b]">Nenhum TUSS/IPASGO vinculado. Use o gerenciador de vínculos na tela anterior.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[390px] text-left text-[12px]">
                  <thead className="text-[10px] uppercase text-[#94a3b8]">
                    <tr><th className="pb-2">Sistema / código</th><th className="pb-2">Versão</th><th className="pb-2">Qtd.</th><th className="pb-2">Status</th></tr>
                  </thead>
                  <tbody>
                    {procedure.codes.map((code) => (
                      <tr key={code.id} className="border-t border-[#e2e8f0] align-top">
                        <td className="py-2 pr-2"><strong>{code.codeSystem} {code.code}</strong><div className="mt-1 text-[11px] text-[#64748b]">{code.description}</div></td>
                        <td className="py-2 pr-2">{code.version || "—"}<div className="mt-1 text-[10px] text-[#64748b]">{code.validFrom ?? "…"} → {code.validUntil ?? "…"}</div></td>
                        <td className="py-2 pr-2">{code.defaultQuantity}</td>
                        <td className="py-2">{code.active ? "Ativo" : "Inativo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
