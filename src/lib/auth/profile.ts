import type { SessionUser, UserRole } from "@/types/domain";

export interface StoredAuthProfile {
  organizationId?: unknown;
  role?: unknown;
  fullName?: unknown;
  email?: unknown;
  active?: unknown;
}

/**
 * Converte somente perfis explicitamente ativos e íntegros.
 * Nunca infere papel nem organização durante o login.
 */
export function activeProfileToSession(userId: string, value: unknown): SessionUser | null {
  if (!userId || !value || typeof value !== "object") return null;
  const data = value as StoredAuthProfile;
  const organizationId =
    typeof data.organizationId === "string" ? data.organizationId.trim() : "";
  const role = data.role;
  const active = data.active === true;

  if (!organizationId || !active || (role !== "admin" && role !== "doctor")) {
    return null;
  }

  return {
    id: userId,
    organizationId,
    role: role as UserRole,
    fullName: typeof data.fullName === "string" ? data.fullName.trim() : "",
    email: typeof data.email === "string" ? data.email.trim().toLowerCase() : "",
  };
}
