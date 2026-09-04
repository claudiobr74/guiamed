import { firebaseAuth } from "@/lib/firebase/admin";
import { firebaseWebApiKey } from "@/lib/firebase/config";
import { normalizeEmail } from "@/lib/auth/email";
import { getDb } from "@/lib/db/client";
import { activeProfileToSession } from "@/lib/auth/profile";
import { SEARCH_INDEX_VERSION } from "@/lib/search-index";
import type { Profile, SessionUser } from "@/types/domain";

const ACCOUNT_PROFILE_ERROR =
  "Esta conta não possui um perfil ativo no GuiaMed. Solicite acesso a um administrador.";

async function provisionOrganizationOwner(input: {
  uid: string;
  email: string;
  fullName: string;
  organizationName: string;
}): Promise<SessionUser> {
  const db = await getDb();
  const existing = await db.collection("users").doc(input.uid).get();
  if (existing.exists) {
    const session = activeProfileToSession(input.uid, existing.data());
    if (session) return session;
    throw new Error(ACCOUNT_PROFILE_ERROR);
  }
  const now = new Date().toISOString();
  const orgRef = db.collection("organizations").doc();
  // A organização nasce vazia. Marcá-la na versão atual é seguro porque todos
  // os novos pacientes/procedimentos/códigos já são gravados com o índice.
  await orgRef.set({
    name: input.organizationName || "Clínica",
    cnpj: null,
    phone: null,
    email: null,
    address: null,
    createdAt: now,
    updatedAt: now,
    searchIndexVersion: SEARCH_INDEX_VERSION,
    searchIndexedAt: now,
  });
  const profile = {
    organizationId: orgRef.id,
    role: "admin" as const,
    fullName: input.fullName || input.email,
    email: input.email,
    active: true,
    createdAt: now,
  };
  await db.collection("users").doc(input.uid).set(profile);
  return activeProfileToSession(input.uid, profile)!;
}

export async function registerOrganization(input: {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
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

  return provisionOrganizationOwner({
    uid,
    email,
    fullName: input.fullName,
    organizationName: input.organizationName,
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
  const session = snap.exists ? activeProfileToSession(uid, snap.data()) : null;
  if (!session) throw new Error(ACCOUNT_PROFILE_ERROR);
  return session;
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
  const session = activeProfileToSession(snap.id, snap.data());
  if (!session) return null;
  return { ...session, active: true };
}
