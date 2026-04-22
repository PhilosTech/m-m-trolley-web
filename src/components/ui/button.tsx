"use client";

import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/spinner";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "publish" | "unpublish";
  isLoading?: boolean;
};

const VARIANT: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-800 focus:ring-zinc-900 disabled:bg-zinc-400",
  secondary:
    "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 focus:ring-zinc-900 disabled:text-zinc-400",
  danger:
    "bg-red-600 text-white hover:bg-red-500 focus:ring-red-600 disabled:bg-red-300",
  publish:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 focus:ring-emerald-600 disabled:bg-emerald-300",
  unpublish:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus:ring-blue-600 disabled:bg-blue-300",
};

export function Button({
  className,
  variant = "primary",
  isLoading = false,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={(disabled ?? false) || isLoading}
      aria-busy={isLoading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white",
        "disabled:cursor-not-allowed",
        VARIANT[variant],
        className ?? "",
      ].join(" ")}
    >
      {isLoading ? <Spinner className="h-4 w-4 shrink-0" /> : null}
      {children}
    </button>
  );
}

