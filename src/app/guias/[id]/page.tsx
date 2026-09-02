import { AppShell } from "@/components/layout/AppShell";
import { RequestEditor } from "@/features/requests/RequestEditor";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { hydrateRequest, listDoctors, listInstitutions, listInsurers, listKits, listPatients, listTemplates } from "@/lib/db/repos";
import { notFound } from "next/navigation";

export default async function GuiaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const data = await withRls(user.organizationId, user.id, async (db) => {
    try {
      const request = await hydrateRequest(db, user.organizationId, id);
      return {
        request,
        patients: await listPatients(db, user.organizationId),
        doctors: await listDoctors(db, user.organizationId),
        institutions: await listInstitutions(db, user.organizationId),
        insurers: await listInsurers(db, user.organizationId),
        templates: await listTemplates(db, user.organizationId),
        kits: await listKits(db, user.organizationId),
      };
    } catch {
      return null;
    }
  });
  if (!data) notFound();
  return (
    <AppShell user={user} title="Nova solicitação cirúrgica">
      <RequestEditor
        initial={data.request}
        patients={data.patients}
        doctors={data.doctors}
        institutions={data.institutions}
        insurers={data.insurers}
        templates={data.templates}
        kits={data.kits}
      />
    </AppShell>
  );
}
