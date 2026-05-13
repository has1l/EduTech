"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-bg px-4 text-base outline-none transition focus:border-fg",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
