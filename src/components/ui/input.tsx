import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        data-ui="input"
        className={cn(
          "flex h-[38px] w-full min-w-0 rounded-[8px] border bg-white px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] transition-all outline-none",
          error
            ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20"
            : "border-[#E2E8F0] hover:border-[#CBD5E1] focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20",
          "disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"
export { Input }
