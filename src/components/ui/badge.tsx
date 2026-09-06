import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
  variant?: "default" | "secondary" | "success" | "warning" | "danger" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11px] font-semibold transition-colors",
        {
          "bg-[#EFF6FF] text-[#1E5FA6] border border-[#BFDBFE]/60": variant === "default",
          "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]": variant === "secondary",
          "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]": variant === "success",
          "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]": variant === "warning",
          "bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]": variant === "danger",
          "border border-[#E2E8F0] text-[#475569] bg-white": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
