import bcrypt from "bcryptjs";
import { withRls, query, queryOne, getDb } from "@/lib/db/client";
import type { SessionUser, UserRole } from "@/types/domain";

export async function registerOrganization(input: {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
}): Promise<SessionUser> {
  const db = await getDb();
  const existing = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM profiles WHERE lower(email) = lower($1)`,
    [input.email],
  );
  if (existing) {
    throw new Error("Já existe um usuário com este e-mail.");
  }
  const org = await queryOne<{ id: string }>(
    db,
    `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
    [input.organizationName],
  );
  if (!org) throw new Error("Não foi possível criar a organização.");
  const profile = await queryOne<{ id: string }>(
    db,
    `INSERT INTO profiles (organization_id, role, full_name, email, active)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [org.id, input.role ?? "admin", input.fullName, input.email.toLowerCase()],
  );
  if (!profile) throw new Error("Não foi possível criar o perfil.");
  const hash = await bcrypt.hash(input.password, 10);
  await db.query(`INSERT INTO local_credentials (user_id, password_hash) VALUES ($1, $2)`, [
    profile.id,
    hash,
  ]);
  return {
    id: profile.id,
    organizationId: org.id,
    role: input.role ?? "admin",
    fullName: input.fullName,
    email: input.email.toLowerCase(),
  };
}

export async function loginWithPassword(email: string, password: string): Promise<SessionUser> {
  const db = await getDb();
  const row = await queryOne<{
    id: string;
    organization_id: string;
    role: UserRole;
    full_name: string;
    email: string;
    password_hash: string;
    active: boolean;
  }>(
    db,
    `SELECT p.id, p.organization_id, p.role, p.full_name, p.email, p.active, c.password_hash
     FROM profiles p
     JOIN local_credentials c ON c.user_id = p.id
     WHERE lower(p.email) = lower($1)`,
    [email],
  );
  if (!row || !row.active) {
    throw new Error("E-mail ou senha inválidos.");
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throw new Error("E-mail ou senha inválidos.");
  return {
    id: row.id,
    organizationId: row.organization_id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
  };
}

export async function getProfile(userId: string) {
  const db = await getDb();
  return queryOne(
    db,
    `SELECT id, organization_id, role, full_name, email, active FROM profiles WHERE id = $1`,
    [userId],
  );
}

export { withRls, query, queryOne };
