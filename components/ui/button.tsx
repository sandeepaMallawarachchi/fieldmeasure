import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-center leading-tight font-semibold transition-colors duration-150 disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover",
        danger: "bg-danger text-white hover:bg-danger-hover",
        secondary: "bg-neutral-soft text-foreground hover:bg-border",
        outline: "border border-border bg-surface text-foreground hover:bg-neutral-soft",
        ghost: "text-foreground hover:bg-neutral-soft",
      },
      size: {
        lg: "min-h-13 px-4 text-base",
        md: "min-h-12 px-4 text-[15px]",
        sm: "min-h-11 px-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
