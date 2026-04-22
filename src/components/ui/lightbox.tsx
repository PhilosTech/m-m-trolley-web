"use client";

import { useEffect } from "react";

type Props = {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
};

export function Lightbox({ src, alt, isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl font-semibold text-white hover:bg-white/20"
            onClick={onClose}
            aria-label="Close preview"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="max-h-full w-auto max-w-full rounded-xl object-contain"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}
