import * as React from "react"
import { cn } from "../../lib/utils"

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-[12px] font-semibold text-[#475569] leading-none select-none",
        className
      )}
      {...props}
    />
  )
)
Label.displayName = "Label"
export { Label }
