import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui";
import { SearchIndexMaintenance } from "@/features/settings/SearchIndexMaintenance";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getSearchIndexStatus } from "@/lib/db/indexed-search";
import { getOrganization } from "@/lib/db/repos";
import { firebaseReadyMessage } from "@/lib/firebase/admin";

export default async function ConfigPage() {
  const user = await requirePageAdmin();
  const { org, searchIndexStatus } = await withOrganizationContext(user.organizationId, user.id, async (db) => ({
    org: await getOrganization(db, user.organizationId),
    searchIndexStatus: await getSearchIndexStatus(db, user.organizationId),
  }));
  const firebaseStatus = firebaseReadyMessage();
  return (
    <AppShell user={user} title="Configurações">
      <Card className="max-w-xl">
        <h2 className="text-[14px] font-bold">Clínica / organização</h2>
        <dl className="mt-3 space-y-2 text-[13px]">
          <div><dt className="text-[#94a3b8]">Nome</dt><dd className="font-semibold">{org?.name}</dd></div>
          <div><dt className="text-[#94a3b8]">CNPJ</dt><dd>{org?.cnpj ?? "—"}</dd></div>
          <div><dt className="text-[#94a3b8]">Perfil</dt><dd>{user.role === "admin" ? "Administrador" : "Médico"}</dd></div>
          <div><dt className="text-[#94a3b8]">Firebase</dt><dd>{firebaseStatus === "ok" ? "guiamed-918ee" : firebaseStatus}</dd></div>
        </dl>
        <p className="mt-4 text-[12px] text-[#475569]">
          Documentos médicos ficam no Firebase Storage privado do projeto guiamed-918ee. O acesso passa pela sessão do servidor; as regras do Storage negam leitura direta.
        </p>
        <SearchIndexMaintenance initialStatus={searchIndexStatus} />
      </Card>
    </AppShell>
  );
}
