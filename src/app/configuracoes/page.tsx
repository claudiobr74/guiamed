import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { queryOne } from "@/lib/db/client";

export default async function ConfigPage() {
  const user = await requirePageUser();
  const org = await withRls(user.organizationId, user.id, (db) =>
    queryOne<{ name: string; cnpj: string | null }>(db, `SELECT name, cnpj FROM organizations WHERE id=$1`, [user.organizationId]),
  );
  return (
    <AppShell user={user} title="Configurações">
      <Card className="max-w-xl">
        <h2 className="text-[14px] font-bold">Clínica / organização</h2>
        <dl className="mt-3 space-y-2 text-[13px]">
          <div><dt className="text-[#94a3b8]">Nome</dt><dd className="font-semibold">{org?.name}</dd></div>
          <div><dt className="text-[#94a3b8]">CNPJ</dt><dd>{org?.cnpj ?? "—"}</dd></div>
          <div><dt className="text-[#94a3b8]">Perfil</dt><dd>{user.role === "admin" ? "Administrador" : "Médico"}</dd></div>
        </dl>
        <p className="mt-4 text-[12px] text-[#475569]">
          Documentos médicos ficam em armazenamento privado. Produção exige projeto Supabase próprio do GuiaMed, buckets privados e as variáveis em .env.example.
        </p>
      </Card>
    </AppShell>
  );
}
