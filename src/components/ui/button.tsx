"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn font-semibold no-animation [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "btn-primary",
        outline: "btn-outline border-base-content/15 text-base-content",
        secondary: "btn-secondary",
        ghost: "btn-ghost",
        destructive: "btn-error btn-soft",
        link: "btn-link h-auto min-h-0 px-0 normal-case font-semibold",
      },
      size: {
        default: "btn-md",
        xs: "btn-xs",
        sm: "btn-sm",
        lg: "btn-lg",
        icon: "btn-square btn-md",
        "icon-xs": "btn-square btn-xs",
        "icon-sm": "btn-square btn-sm",
        "icon-lg": "btn-square btn-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
