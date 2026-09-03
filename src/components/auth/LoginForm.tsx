"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { loginAction } from "@/app/auth-actions";
import { Button, Field, Input } from "@/components/ui";
import { Icon } from "@/components/icons";

const LOGO_SOURCE_SIZE = 1536;
const LOGO_BOUNDS = {
  x: 241,
  y: 581,
  width: 1134,
  height: 371,
} as const;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(loginAction, null);
  const visibleWidth = 300;
  const scale = visibleWidth / LOGO_BOUNDS.width;
  const visibleHeight = LOGO_BOUNDS.height * scale;
  const sourceRenderedSize = LOGO_SOURCE_SIZE * scale;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#f1f5f9] px-4">
      <form action={action} className="flex w-full max-w-[380px] flex-col items-center gap-6">
        <div
          className="relative block shrink-0 overflow-hidden"
          style={{ width: visibleWidth, height: visibleHeight }}
          aria-label="LizaCare — Inteligência que cuida"
        >
          <Image
            src="/brand/lizacare-logo.webp"
            alt="LizaCare — Inteligência que cuida"
            width={LOGO_SOURCE_SIZE}
            height={LOGO_SOURCE_SIZE}
            unoptimized
            priority
            className="absolute max-w-none"
            style={{
              width: sourceRenderedSize,
              height: sourceRenderedSize,
              left: -LOGO_BOUNDS.x * scale,
              top: -LOGO_BOUNDS.y * scale,
            }}
          />
        </div>
        <div className="w-full rounded-xl border border-[#e2e8f0] bg-white p-8">
          <h1 className="text-[18px] font-bold text-[#0f172a]">Acessar plataforma</h1>
          <p className="mt-1 text-[13px] text-[#475569]">Preencha seus dados para continuar</p>
          <div className="mt-5 flex flex-col gap-4">
            <Field label="E-mail">
              <Input name="email" type="email" autoComplete="email" required placeholder="medico@clinica.com.br" />
            </Field>
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-[12px] font-semibold text-[#475569]">Senha</label>
                <Link href="/recuperar-senha" className="text-[12px] font-medium text-[#1e5fa6]">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  <Icon name={showPassword ? "eye" : "eye-off"} size={14} />
                </button>
              </div>
            </div>
          </div>
          {state?.error ? <p role="alert" className="mt-4 text-[12px] text-[#dc2626]">{state.error}</p> : null}
          <Button type="submit" className="mt-5 w-full text-[14px]" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
          <p className="mt-4 text-center text-[12px] text-[#475569]">
            Primeiro acesso?{" "}
            <Link href="/register" className="font-semibold text-[#1e5fa6]">
              Criar organização
            </Link>
          </p>
        </div>
      </form>
      <p className="text-[11px] text-[#64748b]">LizaCare • Inteligência que cuida</p>
    </div>
  );
}
