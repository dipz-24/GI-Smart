import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#e05b2b] text-white",
        secondary: "bg-[#ede8df] text-[#1a1a14]",
        low: "bg-[#d8f3dc] text-[#2d6a4f]",
        medium: "bg-[#fef3c7] text-[#7a5800]",
        high: "bg-[#ffe4d6] text-[#c1440e]",
        outline: "border border-[rgba(26,26,20,0.2)] text-[#4a4a3a]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
