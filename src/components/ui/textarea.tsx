import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[90px] w-full rounded-[8px] border bg-white p-3 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] transition-all outline-none resize-y",
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
Textarea.displayName = "Textarea"
export { Textarea }
