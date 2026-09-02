import { firebaseAuth } from "@/lib/firebase/admin";
import { firebaseWebApiKey } from "@/lib/firebase/config";
import { getDb } from "@/lib/db/client";
import type { Profile, SessionUser, UserRole } from "@/types/domain";

interface AuthProfile {
  organizationId: string;
  role: UserRole;
  fullName: string;
  email: string;
  active: boolean;
}

export async function registerOrganization(input: {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
}): Promise<SessionUser> {
  const email = input.email.toLowerCase();
  const db = await getDb();
  const existing = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!existing.empty) {
    throw new Error("Já existe um usuário com este e-mail.");
  }
  const userRecord = await firebaseAuth().createUser({
    email,
    password: input.password,
    displayName: input.fullName,
  });
  const orgRef = db.collection("organizations").doc();
  await orgRef.set({
    name: input.organizationName,
    cnpj: null,
    phone: null,
    email: null,
    address: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const role = input.role ?? "admin";
  await db.collection("users").doc(userRecord.uid).set({
    organizationId: orgRef.id,
    role,
    fullName: input.fullName,
    email,
    active: true,
    createdAt: new Date().toISOString(),
  } satisfies AuthProfile & { createdAt: string });
  return {
    id: userRecord.uid,
    organizationId: orgRef.id,
    role,
    fullName: input.fullName,
    email,
  };
}

export async function loginWithPassword(email: string, password: string): Promise<SessionUser> {
  const apiKey = firebaseWebApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = (await response.json()) as { localId?: string; error?: { message?: string } };
  if (!response.ok || !payload.localId) {
    throw new Error("E-mail ou senha inválidos.");
  }
  const db = await getDb();
  const snap = await db.collection("users").doc(payload.localId).get();
  const data = snap.data() as AuthProfile | undefined;
  if (!snap.exists || !data || !data.active) {
    throw new Error("E-mail ou senha inválidos.");
  }
  return {
    id: payload.localId,
    organizationId: data.organizationId,
    role: data.role,
    fullName: data.fullName,
    email: data.email,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = await getDb();
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  const role = data.role as UserRole;
  if (role !== "admin" && role !== "doctor") return null;
  return {
    id: snap.id,
    organizationId: String(data.organizationId ?? ""),
    role,
    fullName: String(data.fullName ?? ""),
    email: String(data.email ?? ""),
    active: data.active !== false,
  };
}
