"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/app/auth-actions";
import { Logo } from "@/components/Logo";
import { Button, Field, Input } from "@/components/ui";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#f1f5f9] px-4">
      <Logo size="lg" />
      <form action={action} className="w-full max-w-[380px] rounded-xl border border-[#e2e8f0] bg-white p-8">
        <h1 className="text-[18px] font-bold text-[#0f172a]">Criar organização</h1>
        <p className="mt-1 text-[13px] text-[#475569]">Cadastre a clínica e o primeiro administrador</p>
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Organização">
            <Input name="organizationName" required placeholder="Clínica exemplo" />
          </Field>
          <Field label="Seu nome">
            <Input name="fullName" required />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Senha">
            <Input name="password" type="password" minLength={8} required />
          </Field>
        </div>
        {state?.error ? <p className="mt-4 text-[12px] text-[#dc2626]">{state.error}</p> : null}
        <Button type="submit" className="mt-5 w-full" disabled={pending}>
          {pending ? "Criando…" : "Criar acesso"}
        </Button>
        <p className="mt-4 text-center text-[12px] text-[#475569]">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-[#1e5fa6]">
            Entrar
          </Link>
        </p>
      </form>
      <p className="text-[11px] text-[#94a3b8]">GuiaMed SaaS • v1.4.2 • Segurança Certificada</p>
    </div>
  );
}
