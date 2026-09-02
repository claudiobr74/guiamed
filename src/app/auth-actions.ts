"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { toUserFacingAuthError } from "@/lib/auth/errors";
import { loginWithPassword, registerOrganization, requestPasswordReset } from "@/lib/db/auth";

export type AuthFormState = { error: string } | null;

async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const user = await loginWithPassword(email, password);
    await setSessionCookie(encodeSession(user));
  } catch (err) {
    return { error: toUserFacingAuthError(err) };
  }
  redirect("/");
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    const user = await registerOrganization({
      organizationName: String(formData.get("organizationName") ?? "Clínica"),
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    await setSessionCookie(encodeSession(user));
  } catch (err) {
    return { error: toUserFacingAuthError(err) };
  }
  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function requestPasswordResetAction(email: string) {
  if (!email.trim()) throw new Error("Informe o e-mail.");
  await requestPasswordReset(email);
  return { ok: true as const };
}
