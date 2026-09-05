import * as React from "react"
import { cn } from "../../lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            "flex h-[38px] w-full appearance-none rounded-[8px] border bg-white px-3 pr-8 text-[13px] text-[#0F172A] transition-all outline-none",
            error
              ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20"
              : "border-[#E2E8F0] hover:border-[#CBD5E1] focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20",
            "disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#94A3B8]">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    )
  }
)
Select.displayName = "Select"
export { Select }
