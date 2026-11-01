import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function IconButton({
  label,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl text-foreground transition-colors duration-150 hover:bg-neutral-soft disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
