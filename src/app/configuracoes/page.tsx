import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { SearchIndexMaintenance } from "@/features/settings/SearchIndexMaintenance";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getSearchIndexStatus } from "@/lib/db/indexed-search";
import { getOrganizationSettings } from "@/lib/db/organization";
import { firebaseReadyMessage } from "@/lib/firebase/admin";
import { saveOrganizationSettingsAction } from "./actions";

export default async function ConfigPage() {
  const user = await requirePageAdmin();
  const { org, searchIndexStatus } = await withOrganizationContext(user.organizationId, user.id, async (db) => ({
    org: await getOrganizationSettings(db, user.organizationId),
    searchIndexStatus: await getSearchIndexStatus(db, user.organizationId),
  }));
  const firebaseStatus = firebaseReadyMessage();

  return (
    <AppShell user={user} title="Configurações">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,680px)_minmax(320px,1fr)]">
        <Card>
          <h2 className="text-[14px] font-bold">Clínica / organização</h2>
          <p className="mt-1 text-[12px] text-[#64748b]">Esses dados identificam a organização no GuiaMed e podem ser usados em documentos e auditorias administrativas.</p>
          <form action={saveOrganizationSettingsAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2"><Field label="Nome da clínica / organização"><Input name="name" defaultValue={org?.name ?? ""} required /></Field></div>
            <Field label="CNPJ"><Input name="cnpj" defaultValue={org?.cnpj ?? ""} inputMode="numeric" /></Field>
            <Field label="Telefone"><Input name="phone" defaultValue={org?.phone ?? ""} inputMode="tel" /></Field>
            <div className="md:col-span-2"><Field label="E-mail"><Input name="email" type="email" defaultValue={org?.email ?? ""} /></Field></div>
            <div className="md:col-span-2"><Field label="Endereço"><Textarea name="address" defaultValue={org?.address ?? ""} className="min-h-[88px]" /></Field></div>
            <div className="md:col-span-2 flex justify-end"><Button type="submit">Salvar configurações</Button></div>
          </form>
        </Card>

        <Card>
          <h2 className="text-[14px] font-bold">Ambiente e segurança</h2>
          <dl className="mt-3 space-y-2 text-[13px]">
            <div><dt className="text-[#94a3b8]">Perfil atual</dt><dd>{user.role === "admin" ? "Administrador" : "Médico"}</dd></div>
            <div><dt className="text-[#94a3b8]">Firebase</dt><dd>{firebaseStatus === "ok" ? "guiamed-918ee" : firebaseStatus}</dd></div>
            <div><dt className="text-[#94a3b8]">Última atualização da organização</dt><dd>{org?.updatedAt ? new Date(org.updatedAt).toLocaleString("pt-BR") : "—"}</dd></div>
          </dl>
          <p className="mt-4 text-[12px] text-[#475569]">
            Documentos médicos ficam no Firebase Storage privado. O acesso passa pela sessão do servidor; leitura direta do Storage não é usada para os documentos clínicos.
          </p>
          <SearchIndexMaintenance initialStatus={searchIndexStatus} />
        </Card>
      </div>
    </AppShell>
  );
}
