import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#D8A7B1] text-white hover:bg-[#D8A7B1]/80",
        secondary:
          "border-transparent bg-[#3C4858]/10 text-[#3C4858] hover:bg-[#3C4858]/20",
        destructive:
          "border-transparent bg-[#D8A7B1] text-white hover:bg-[#D8A7B1]/80",
        outline: "text-[#3C4858] border-[#3C4858]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants } 