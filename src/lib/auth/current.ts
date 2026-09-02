import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/auth";
import { hasFirebaseAdminCredentials } from "@/lib/firebase/admin";
import type { SessionUser } from "@/types/domain";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (!hasFirebaseAdminCredentials()) {
    return process.env.NODE_ENV === "production" ? null : session;
  }
  try {
    const profile = await getProfile(session.id);
    if (!profile || !profile.active) return null;
    if (profile.organizationId !== session.organizationId) return null;
    return {
      id: session.id,
      organizationId: profile.organizationId,
      role: profile.role,
      fullName: profile.fullName,
      email: profile.email,
    };
  } catch (err) {
    console.error("Falha ao revalidar o perfil da sessão", err);
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
  return user;
}
