"use client";

import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, className, id, ...props }: Props) {
  const inputId = id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
  return (
    <label className="block">
      <div className="text-sm font-medium text-zinc-900">{label}</div>
      <input
        id={inputId}
        {...props}
        className={[
          "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
          "focus:outline-none focus:ring-2 focus:ring-zinc-900",
          "disabled:bg-zinc-50 disabled:text-zinc-400",
          className ?? "",
        ].join(" ")}
      />
    </label>
  );
}

