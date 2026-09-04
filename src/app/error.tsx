"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f1f5f9] px-4">
      <div className="w-full max-w-[380px] rounded-xl border border-[#e2e8f0] bg-white p-8 text-center">
        <h1 className="text-[18px] font-bold text-[#0f172a]">Não foi possível carregar esta página</h1>
        <p className="mt-2 text-[13px] text-[#475569]">
          Recarregue para tentar de novo. Se o erro continuar, confira a sessão e a configuração do Firebase na Vercel. Em uploads de documentos, confirme também se o Cloud Storage do projeto está provisionado e acessível.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[10px] text-[#94a3b8]">Código de suporte: {error.digest}</p>
        ) : null}
        <Button type="button" className="mt-5 w-full" onClick={() => reset()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
