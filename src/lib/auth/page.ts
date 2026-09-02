import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import type { SessionUser } from "@/types/domain";

export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "admin") notFound();
  return user;
}
