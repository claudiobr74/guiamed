import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { listCodes } from "@/lib/db/repos";
import { importCodesAction } from "@/app/actions";

export default async function TabelasPage() {
  const user = await requirePageUser();
  const codes = await withRls(user.organizationId, user.id, (db) => listCodes(db, user.organizationId));
  return (
    <AppShell user={user} title="Tabelas TUSS / IPASGO">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {codes.length === 0 ? (
          <EmptyState title="Nenhum código importado" description="A IA não inventa TUSS, IPASGO ou CID. Importe a tabela oficial (CSV, XLSX ou JSON)." />
        ) : (
          <Card>
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Sistema</th><th className="pb-2">Código</th><th className="pb-2">Descrição</th><th className="pb-2">Versão</th></tr></thead>
              <tbody>
                {codes.slice(0, 200).map((c) => (
                  <tr key={c.id} className="border-t border-[#e2e8f0]">
                    <td className="py-2">{c.codeSystem}</td>
                    <td>{c.code}</td>
                    <td>{c.description}</td>
                    <td>{c.version}{c.active ? "" : " • inativo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {user.role === "admin" ? (
          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Importar tabela</h2>
            <form
              action={async (formData) => {
                "use server";
                const result = await importCodesAction(formData);
                if (!result.ok) {
                  throw new Error(result.issues.map((i) => `Linha ${i.row}: ${i.message}`).join(" | "));
                }
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Sistema">
                <Select name="codeSystem" defaultValue="TUSS">
                  <option value="TUSS">TUSS</option>
                  <option value="IPASGO">IPASGO</option>
                </Select>
              </Field>
              <Field label="Versão"><Input name="version" required placeholder="2026.1" /></Field>
              <Field label="Arquivo">
                <Input name="file" type="file" accept=".csv,.xlsx,.xls,.json" required />
              </Field>
              <p className="text-[12px] text-[#475569]">Colunas: code, description, version, code_system, valid_from, valid_until, procedure_name. Importação idempotente por sistema+código+versão.</p>
              <Button type="submit">Importar</Button>
            </form>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
