"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current";
import { withOrganizationContext } from "@/lib/db/client";
import { updateOrganizationSettings } from "@/lib/db/organization";
import { parseOrganizationSettings } from "@/lib/validation/organization";

export async function saveOrganizationSettingsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const input = parseOrganizationSettings({
    name: formData.get("name"),
    cnpj: formData.get("cnpj"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
  });
  await withOrganizationContext(user.organizationId, user.id, (db) =>
    updateOrganizationSettings(db, user, input),
  );
  revalidatePath("/configuracoes");
}
