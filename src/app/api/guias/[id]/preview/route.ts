import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { withOrganizationContext } from "@/lib/db/client";
import { renderRequestPdf } from "@/lib/pdf/render-request";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 });
  }

  try {
    const rendered = await withOrganizationContext(user.organizationId, user.id, (db) =>
      renderRequestPdf(db, user, id),
    );
    return new NextResponse(Buffer.from(rendered.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="previa-${id}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível gerar a prévia.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
