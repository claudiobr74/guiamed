import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth/current";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <LoginForm />;
}
