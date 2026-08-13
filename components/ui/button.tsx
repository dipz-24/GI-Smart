import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-600 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e05b2b] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#e05b2b] text-white hover:brightness-105 shadow-sm",
        secondary: "bg-[#ede8df] text-[#1a1a14] hover:bg-[#e2ddd4] border border-[rgba(26,26,20,0.12)]",
        outline: "border border-[#e05b2b] text-[#e05b2b] bg-transparent hover:bg-[rgba(224,91,43,0.06)]",
        ghost: "text-[#4a4a3a] hover:bg-[rgba(26,26,20,0.05)] hover:text-[#1a1a14]",
        destructive: "bg-[#c1440e] text-white hover:brightness-105",
        link: "text-[#e05b2b] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
