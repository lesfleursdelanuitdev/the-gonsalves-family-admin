import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "input input-bordered input-md w-full min-w-0 border border-solid bg-base-100 text-base-content transition-[box-shadow,border-color]",
        /* Stronger than global * / border-base-content/12 so fields read in business + light themes */
        "border-[color-mix(in_oklch,var(--color-base-content)_34%,var(--color-base-300))] app-light:border-[color-mix(in_oklch,var(--color-base-content)_26%,var(--color-base-300))]",
        "placeholder:text-base-content/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-error/25",
        className
      )}
      {...props}
    />
  )
}

export { Input }
