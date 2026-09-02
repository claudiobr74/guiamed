import { getCurrentUser } from "@/lib/auth/current";
import { fileContentType, getObject } from "@/lib/storage";
import { authorizedStoragePath } from "@/lib/storage/path";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { path } = await context.params;
  const filePath = authorizedStoragePath(path, user.organizationId);
  if (!filePath) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const bytes = await getObject(filePath, user.organizationId);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": fileContentType(filePath),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}
