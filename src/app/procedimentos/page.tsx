import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { listProcedures } from "@/lib/db/repos";
import { saveProcedureAction } from "@/app/actions";
import { CODE_NOT_FOUND } from "@/types/domain";

export default async function ProcedimentosPage() {
  const user = await requirePageUser();
  const procedures = await withRls(user.organizationId, user.id, (db) => listProcedures(db, user.organizationId));
  return (
    <AppShell user={user} title="Procedimentos">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {procedures.length === 0 ? (
          <EmptyState title="Nenhum procedimento canônico" description="Cadastre o nome clínico e importe códigos TUSS/IPASGO na tela de tabelas. O sistema não inventa códigos." />
        ) : (
          <Card>
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Nome</th><th className="pb-2">TUSS</th><th className="pb-2">IPASGO</th></tr></thead>
              <tbody>
                {procedures.map((p) => {
                  const tuss = p.codes.find((c) => c.codeSystem === "TUSS" && c.active);
                  const ipasgo = p.codes.find((c) => c.codeSystem === "IPASGO" && c.active);
                  return (
                    <tr key={p.id} className="border-t border-[#e2e8f0]">
                      <td className="py-2 font-semibold">{p.name}</td>
                      <td>{tuss?.code ?? CODE_NOT_FOUND}</td>
                      <td>{ipasgo?.code ?? CODE_NOT_FOUND}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        {user.role === "admin" ? (
          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Novo procedimento</h2>
            <form
              action={async (formData) => {
                "use server";
                await saveProcedureAction({
                  name: String(formData.get("name")),
                  description: String(formData.get("description") || "") || undefined,
                  specialty: String(formData.get("specialty") || "") || undefined,
                  synonyms: String(formData.get("synonyms") || "").split(",").map((s) => s.trim()).filter(Boolean),
                });
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Nome"><Input name="name" required /></Field>
              <Field label="Especialidade"><Input name="specialty" /></Field>
              <Field label="Sinônimos (vírgula)"><Input name="synonyms" /></Field>
              <Button type="submit">Cadastrar</Button>
            </form>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
