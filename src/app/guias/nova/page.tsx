import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { createDraft } from "@/lib/db/repos";

export default async function NovaGuiaPage() {
  const user = await requirePageUser();
  const id = await withRls(user.organizationId, user.id, (db) => createDraft(db, user));
  redirect(`/guias/${id}`);
}
