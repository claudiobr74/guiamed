import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-[8px] text-[13px] font-semibold transition-all select-none disabled:pointer-events-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] disabled:border-[#E2E8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5FA6]/20 focus-visible:border-[#1E5FA6]",
          {
            // Primário: #1E5FA6, hover escurece para #174C85, texto branco
            "bg-[#1E5FA6] text-white hover:bg-[#174C85] active:bg-[#133F6E] shadow-none border-0": variant === "default",
            // Secundário / Outline: Fundo branco, borda #E2E8F0, texto #475569
            "border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] active:bg-[#F1F5F9] shadow-none": variant === "outline" || variant === "secondary",
            // Ghost: Fundo transparente, texto #1E5FA6
            "bg-transparent text-[#1E5FA6] hover:bg-[#EFF6FF] border-0": variant === "ghost",
            // Destrutivo: #DC2626
            "bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] border-0": variant === "destructive",
            
            // Tamanhos
            "h-[38px] px-4 py-2": size === "default",
            "h-[32px] px-3 text-[12px]": size === "sm",
            "h-[42px] px-6 text-[14px]": size === "lg",
            "h-[38px] w-[38px] p-0": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button }
