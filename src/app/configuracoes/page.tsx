import Link from "next/link";
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
      <nav aria-label="Seções de configurações" className="mb-6 flex gap-6 overflow-x-auto border-b border-[#e2e8f0] text-[12px] font-semibold">
        <span aria-current="page" className="border-b-2 border-[#1e5fa6] px-1 pb-3 text-[#1e5fa6]">Clínica</span>
        <Link href="/tabelas" className="px-1 pb-3 text-[#475569] hover:text-[#1e5fa6]">Tabelas TUSS/IPASGO</Link>
        <a href="#ambiente" className="px-1 pb-3 text-[#475569] hover:text-[#1e5fa6]">Ambiente e segurança</a>
      </nav>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,680px)_minmax(320px,1fr)]">
        <Card>
          <h2 className="text-[15px] font-bold">Dados gerais da clínica</h2>
          <p className="mt-1 text-[12px] text-[#64748b]">Esses dados identificam a organização na LizaCare e podem ser usados em documentos e auditorias administrativas.</p>
          <form action={saveOrganizationSettingsAction} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Field label="Nome da clínica / organização"><Input name="name" defaultValue={org?.name ?? ""} required /></Field></div>
            <Field label="CNPJ"><Input name="cnpj" defaultValue={org?.cnpj ?? ""} inputMode="numeric" /></Field>
            <Field label="Telefone"><Input name="phone" defaultValue={org?.phone ?? ""} inputMode="tel" /></Field>
            <div className="md:col-span-2"><Field label="E-mail"><Input name="email" type="email" defaultValue={org?.email ?? ""} /></Field></div>
            <div className="md:col-span-2"><Field label="Endereço completo"><Textarea name="address" defaultValue={org?.address ?? ""} className="min-h-[88px]" /></Field></div>
            <div className="md:col-span-2 flex justify-end"><Button type="submit">Salvar configurações</Button></div>
          </form>
        </Card>

        <div id="ambiente" className="scroll-mt-24">
          <Card>
            <h2 className="text-[15px] font-bold">Ambiente e segurança</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">Estado operacional do ambiente e do índice usado nas buscas administrativas e clínicas.</p>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-lg bg-[#f8fafc] px-3 py-2"><dt className="text-[11px] text-[#64748b]">Perfil atual</dt><dd className="mt-0.5 font-semibold text-[#0f172a]">{user.role === "admin" ? "Administrador" : "Médico"}</dd></div>
              <div className="rounded-lg bg-[#f8fafc] px-3 py-2"><dt className="text-[11px] text-[#64748b]">Firebase</dt><dd className="mt-0.5 font-semibold text-[#0f172a]">{firebaseStatus === "ok" ? "guiamed-918ee" : firebaseStatus}</dd></div>
              <div className="rounded-lg bg-[#f8fafc] px-3 py-2 sm:col-span-2 xl:col-span-1"><dt className="text-[11px] text-[#64748b]">Última atualização da organização</dt><dd className="mt-0.5 font-semibold text-[#0f172a]">{org?.updatedAt ? new Date(org.updatedAt).toLocaleString("pt-BR") : "—"}</dd></div>
            </dl>
            <p className="mt-4 rounded-lg bg-[#eff6ff] px-3 py-2 text-[12px] text-[#1e5fa6]">
              Documentos médicos ficam no Firebase Storage privado. O acesso passa pela sessão do servidor; leitura direta do Storage não é usada para documentos clínicos.
            </p>
            <SearchIndexMaintenance initialStatus={searchIndexStatus} />
          </Card>
        </div>
      </div>

      <p className="mt-5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[12px] text-[#1e5fa6]">
        Os dados da organização podem ser inseridos nos PDFs quando houver campos correspondentes configurados no template.
      </p>
    </AppShell>
  );
}
