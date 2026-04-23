"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-[1.125rem] shrink-0 items-center justify-center rounded-[4px] border-2 border-solid transition-[color,background-color,border-color,box-shadow] outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2",
        /* Explicit contrast: Daisy business often has no `.dark` class, so `dark:*` tokens alone fail on tinted panels */
        "border-[color-mix(in_oklch,var(--color-base-content)_42%,var(--color-base-300))] lemonade:border-[color-mix(in_oklch,var(--color-base-content)_30%,var(--color-base-300))]",
        "bg-base-100 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--color-base-content)_8%,transparent)]",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25",
        "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-checked:shadow-none",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
