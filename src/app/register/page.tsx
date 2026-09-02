import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/auth/current";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <RegisterForm />;
}
