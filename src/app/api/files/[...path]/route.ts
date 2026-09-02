import { getCurrentUser } from "@/lib/auth/current";
import { fileContentType, getObject } from "@/lib/storage";
import { authorizedStoragePath } from "@/lib/storage/path";
import { NextResponse } from "next/server";
import { getDb, orgCollection } from "@/lib/db/client";

async function canAccessFile(filePath: string, organizationId: string, role: "admin" | "doctor"): Promise<boolean> {
  const bucket = filePath.split("/")[0];
  if (bucket === "signatures") return false;
  const db = await getDb();
  if (bucket === "generated-documents") {
    const docs = await orgCollection(db, organizationId, "generatedDocuments").where("filePath", "==", filePath).limit(1).get();
    return !docs.empty;
  }
  if (bucket === "pdf-templates" && role === "admin") {
    const versions = await db.collection("templateVersions").where("organizationId", "==", organizationId).get();
    return versions.docs.some((version) => version.data().filePath === filePath);
  }
  return false;
}

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
  if (!(await canAccessFile(filePath, user.organizationId, user.role))) {
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
