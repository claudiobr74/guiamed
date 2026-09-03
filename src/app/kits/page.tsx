import { AppShell } from "@/components/layout/AppShell";
import { Card, EmptyState } from "@/components/ui";
import { KitEditor } from "@/features/kits/KitEditor";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listKits, listProcedures } from "@/lib/db/repos";
import { CODE_NOT_FOUND } from "@/types/domain";

export default async function KitsPage() {
  const user = await requirePageAdmin();
  const { kits, procedures } = await withOrganizationContext(user.organizationId, user.id, async (db) => ({
    kits: await listKits(db, user.organizationId),
    procedures: await listProcedures(db, user.organizationId),
  }));
  const procedureById = new Map(procedures.map((procedure) => [procedure.id, procedure]));

  return (
    <AppShell user={user} title="Kits cirúrgicos">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {kits.length === 0 ? (
            <EmptyState title="Nenhum kit" description="Um kit carrega vários procedimentos com quantidade padrão em um clique." />
          ) : (
            kits.map((kit) => (
              <Card key={kit.id}>
                <h2 className="text-[14px] font-bold">{kit.name}</h2>
                {kit.description ? <p className="mt-1 text-[12px] text-[#64748b]">{kit.description}</p> : null}
                <ul className="mt-3 flex flex-col gap-2 text-[12px] text-[#475569]">
                  {kit.items.map((item) => {
                    const procedure = procedureById.get(item.procedureId);
                    const preferredCode = procedure?.codes.find((code) => code.id === item.defaultCodeId);
                    return (
                      <li key={item.id} className="rounded-lg bg-[#f8fafc] px-3 py-2">
                        <span className="font-semibold text-[#0f172a]">{item.procedureName}</span>
                        <span> — qtd {item.defaultQuantity}</span>
                        <span className="ml-2 text-[#64748b]">
                          {preferredCode
                            ? `${preferredCode.codeSystem} ${preferredCode.code}`
                            : `código ${CODE_NOT_FOUND.toLowerCase()} / resolução automática`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))
          )}
        </div>

        <Card>
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-[#0f172a]">Editor administrativo de kits</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">
              Configure cada item de forma explícita. A quantidade começa em 1 e pode ser alterada; ao escolher um código de referência, a quantidade padrão desse código é sugerida automaticamente.
            </p>
          </div>
          <KitEditor kits={kits} procedures={procedures} />
        </Card>
      </div>
    </AppShell>
  );
}
