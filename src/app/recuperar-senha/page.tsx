"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth-actions";
import { Logo } from "@/components/Logo";
import { Button, Field, Input } from "@/components/ui";

export default function RecuperarSenhaPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#f1f5f9] px-4">
      <Logo size="lg" href="/login" />
      <form
        className="w-full max-w-[380px] rounded-xl border border-[#e2e8f0] bg-white p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          const form = new FormData(event.currentTarget);
          try {
            await requestPasswordResetAction(String(form.get("email") ?? ""));
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
          }
        }}
      >
        <h1 className="text-[18px] font-bold text-[#0f172a]">Recuperar senha</h1>
        <p className="mt-1 text-[13px] text-[#475569]">
          Informe o e-mail da conta. Se ele existir na plataforma LizaCare, enviaremos o link de redefinição.
        </p>
        {sent ? (
          <p className="mt-5 rounded-lg bg-[#ecfdf5] px-3 py-2 text-[13px] text-[#16a34a]">
            Se o e-mail estiver cadastrado, o link de redefinição já foi enviado.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <Field label="E-mail">
              <Input name="email" type="email" required autoComplete="email" />
            </Field>
            {error ? <p className="text-[12px] text-[#dc2626]">{error}</p> : null}
            <Button type="submit" className="w-full">
              Enviar link
            </Button>
          </div>
        )}
        <p className="mt-4 text-center text-[12px] text-[#475569]">
          <Link href="/login" className="font-semibold text-[#1e5fa6]">
            Voltar ao login
          </Link>
        </p>
      </form>
    </div>
  );
}
