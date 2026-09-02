import Link from "next/link";
import { loginAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#f1f5f9]">
      <div className="flex items-center gap-2">
        <span className="flex size-[34px] items-center justify-center rounded-lg bg-[#1e5fa6] text-lg font-bold text-white">
          +
        </span>
        <span className="text-[24px] font-extrabold text-[#0f172a]">GuiaMed</span>
      </div>
      <form action={loginAction} className="w-[380px] rounded-xl border border-[#e2e8f0] bg-white p-8">
        <h1 className="text-[18px] font-bold text-[#0f172a]">Acessar plataforma</h1>
        <p className="mt-1 text-[13px] text-[#475569]">Preencha seus dados para continuar</p>
        <div className="mt-5 flex flex-col gap-4">
          <Field label="E-mail">
            <Input name="email" type="email" autoComplete="email" required placeholder="ricardo.mendes@guiamed.com.br" />
          </Field>
          <Field label="Senha">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
        </div>
        <Button type="submit" className="mt-5 w-full">
          Entrar
        </Button>
        <p className="mt-4 text-center text-[12px] text-[#475569]">
          Primeiro acesso?{" "}
          <Link href="/register" className="font-semibold text-[#1e5fa6]">
            Criar organização
          </Link>
        </p>
      </form>
      <p className="text-[11px] text-[#94a3b8]">GuiaMed • Segurança e rastreabilidade de documentos</p>
    </div>
  );
}
