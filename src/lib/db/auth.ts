import { firebaseAuth } from "@/lib/firebase/admin";
import { firebaseWebApiKey } from "@/lib/firebase/config";
import { normalizeEmail } from "@/lib/auth/email";
import { getDb } from "@/lib/db/client";
import type { Profile, SessionUser, UserRole } from "@/types/domain";

interface AuthProfile {
  organizationId: string;
  role: UserRole;
  fullName: string;
  email: string;
  active: boolean;
}

function toSession(id: string, data: AuthProfile): SessionUser {
  return {
    id,
    organizationId: data.organizationId,
    role: data.role,
    fullName: data.fullName,
    email: data.email,
  };
}

async function provisionAdminProfile(input: {
  uid: string;
  email: string;
  fullName: string;
  organizationName: string;
  role?: UserRole;
}): Promise<SessionUser> {
  const db = await getDb();
  const existing = await db.collection("users").doc(input.uid).get();
  if (existing.exists) {
    const data = existing.data() as AuthProfile | undefined;
    if (data?.active) return toSession(input.uid, data);
  }
  const now = new Date().toISOString();
  const role = input.role ?? "admin";
  const orgRef = db.collection("organizations").doc();
  await orgRef.set({
    name: input.organizationName || "Clínica",
    cnpj: null,
    phone: null,
    email: null,
    address: null,
    createdAt: now,
    updatedAt: now,
  });
  const profile: AuthProfile & { createdAt: string } = {
    organizationId: orgRef.id,
    role,
    fullName: input.fullName || input.email,
    email: input.email,
    active: true,
    createdAt: now,
  };
  await db.collection("users").doc(input.uid).set(profile);
  return toSession(input.uid, profile);
}

export async function registerOrganization(input: {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
}): Promise<SessionUser> {
  const email = normalizeEmail(input.email);
  const db = await getDb();
  const existing = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!existing.empty) {
    throw new Error("Já existe um usuário com este e-mail.");
  }

  let uid: string;
  try {
    const userRecord = await firebaseAuth().createUser({
      email,
      password: input.password,
      displayName: input.fullName,
    });
    uid = userRecord.uid;
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (!code.includes("email-already-exists")) throw err;
    const signedIn = await signInWithPassword(email, input.password);
    if (!signedIn) throw new Error("Já existe um usuário com este e-mail.");
    uid = signedIn;
  }

  return provisionAdminProfile({
    uid,
    email,
    fullName: input.fullName,
    organizationName: input.organizationName,
    role: input.role,
  });
}

async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const apiKey = firebaseWebApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = (await response.json()) as { localId?: string };
  if (!response.ok || !payload.localId) return null;
  return payload.localId;
}

export async function loginWithPassword(email: string, password: string): Promise<SessionUser> {
  const normalized = normalizeEmail(email);
  const uid = await signInWithPassword(normalized, password);
  if (!uid) throw new Error("E-mail ou senha inválidos.");
  const db = await getDb();
  const snap = await db.collection("users").doc(uid).get();
  const data = snap.data() as AuthProfile | undefined;
  if (snap.exists && data?.active) return toSession(uid, data);
  const record = await firebaseAuth().getUser(uid);
  return provisionAdminProfile({
    uid,
    email: normalized,
    fullName: record.displayName || normalized,
    organizationName: "Clínica",
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const apiKey = firebaseWebApiKey();
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email: normalizeEmail(email) }),
  });
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
