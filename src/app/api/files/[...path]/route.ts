import { getCurrentUser } from "@/lib/auth/current";
import { getObject } from "@/lib/storage/local";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { path } = await context.params;
  const filePath = path.map(decodeURIComponent).join("/");
  if (!filePath.startsWith("pdf-templates/") && !filePath.startsWith("generated-documents/") && !filePath.startsWith("signatures/")) {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }
  if (!filePath.includes(user.organizationId)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  try {
    const bytes = await getObject(filePath);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}
