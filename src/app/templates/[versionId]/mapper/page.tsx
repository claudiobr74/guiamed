import { AppShell } from "@/components/layout/AppShell";
import { PdfMapper } from "@/features/templates/PdfMapper";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getTemplateVersion, listMappings, listRepeaters } from "@/lib/db/repos";
import { authenticatedFileUrl } from "@/lib/storage/path";
import { notFound } from "next/navigation";

export default async function MapperPage({ params }: { params: Promise<{ versionId: string }> }) {
  const user = await requirePageAdmin();
  const { versionId } = await params;
  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const version = await getTemplateVersion(db, user.organizationId, versionId);
    if (!version) return null;
    return {
      version,
      mappings: await listMappings(db, user.organizationId, versionId),
      repeaters: await listRepeaters(db, user.organizationId, versionId),
    };
  });
  if (!data) notFound();
  return (
    <AppShell user={user} title="Editor de mapeamento">
      <PdfMapper
        version={data.version}
        initialMappings={data.mappings}
        initialRepeaters={data.repeaters}
        fileUrl={authenticatedFileUrl(data.version.filePath)}
      />
    </AppShell>
  );
}
