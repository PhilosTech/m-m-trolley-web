"use client";

import { useState } from "react";
import { Lightbox } from "@/components/ui/lightbox";

type Props = {
  photoUrls: string[];
};

export function PhotoGallery({ photoUrls }: Props) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  if (photoUrls.length === 0) {
    return <div className="text-sm text-zinc-500">No photos.</div>;
  }

  return (
    <>
      {photoUrls.length === 1 ? (
        <button
          type="button"
          className="group relative block w-full overflow-hidden rounded-xl"
          onClick={() => setPreviewSrc(photoUrls[0]!)}
          aria-label="Open photo preview"
        >
          <div className="relative h-48 w-full sm:h-64">
            <img
              src={photoUrls[0]!}
              alt="Location photo"
              className="absolute inset-0 h-full w-full rounded-xl object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white">
            Zoom
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photoUrls.map((url) => (
            <button
              key={url}
              type="button"
              className="group relative overflow-hidden rounded-xl"
              onClick={() => setPreviewSrc(url)}
              aria-label="Open photo preview"
            >
              <div className="relative h-24 w-full sm:h-32">
                <img
                  src={url}
                  alt="Location photo"
                  className="absolute inset-0 h-full w-full rounded-xl object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
              <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
                Zoom
              </div>
            </button>
          ))}
        </div>
      )}

      <Lightbox
        src={previewSrc ?? ""}
        alt="Location photo"
        isOpen={previewSrc !== null}
        onClose={() => setPreviewSrc(null)}
      />
    </>
  );
}
