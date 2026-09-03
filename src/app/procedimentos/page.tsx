import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { ProcedureCodeManager } from "@/features/codes/ProcedureCodeManager";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listCodes, listInsurers, listProcedures } from "@/lib/db/repos";
import { saveProcedureAction } from "@/app/actions";
import { CODE_NOT_FOUND } from "@/types/domain";

export default async function ProcedimentosPage() {
  const user = await requirePageAdmin();
  const { procedures, codes, insurers } = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const [procedures, codes, insurers] = await Promise.all([
      listProcedures(db, user.organizationId),
      listCodes(db, user.organizationId),
      listInsurers(db, user.organizationId),
    ]);
    return { procedures, codes, insurers };
  });

  return (
    <AppShell user={user} title="Procedimentos">
      <div className="flex flex-col gap-6">
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

        <Card>
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-[#0f172a]">Vínculos TUSS / IPASGO</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">
              Vincule cada código ao procedimento canônico, defina se ele é geral ou específico de um convênio e ajuste a quantidade padrão usada ao preencher a guia.
            </p>
          </div>
          {codes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cbd5e1] p-8 text-center text-[13px] text-[#64748b]">
              Importe uma tabela TUSS ou IPASGO antes de criar os vínculos.
            </div>
          ) : (
            <ProcedureCodeManager codes={codes} procedures={procedures} insurers={insurers} />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
