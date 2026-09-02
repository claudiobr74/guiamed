import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { listKits, listProcedures } from "@/lib/db/repos";
import { saveKitAction } from "@/app/actions";

export default async function KitsPage() {
  const user = await requirePageUser();
  const { kits, procedures } = await withRls(user.organizationId, user.id, async (db) => ({
    kits: await listKits(db, user.organizationId),
    procedures: await listProcedures(db, user.organizationId),
  }));
  return (
    <AppShell user={user} title="Kits cirúrgicos">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {kits.length === 0 ? (
          <EmptyState title="Nenhum kit" description="Um kit carrega vários procedimentos com quantidade padrão em um clique." />
        ) : (
          kits.map((kit) => (
            <Card key={kit.id}>
              <h2 className="text-[14px] font-bold">{kit.name}</h2>
              <ul className="mt-2 text-[13px] text-[#475569]">
                {kit.items.map((item) => (
                  <li key={item.id}>{item.procedureName} — qtd {item.defaultQuantity}</li>
                ))}
              </ul>
            </Card>
          ))
        )}
        {user.role === "admin" ? (
          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Novo kit</h2>
            <form
              action={async (formData) => {
                "use server";
                const selected = formData.getAll("procedureId").map(String);
                await saveKitAction({
                  name: String(formData.get("name")),
                  items: selected.map((procedureId) => ({ procedureId, defaultQuantity: 1 })),
                });
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Nome"><Input name="name" required placeholder="Artrodese cervical" /></Field>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-[12px] font-semibold text-[#475569]">Procedimentos</legend>
                {procedures.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" name="procedureId" value={p.id} />
                    {p.name}
                  </label>
                ))}
              </fieldset>
              <Button type="submit">Salvar kit</Button>
            </form>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
