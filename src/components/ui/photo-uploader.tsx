"use client";

import { useState } from "react";
import { Lightbox } from "@/components/ui/lightbox";

const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;

type Props = {
  label: string;
  photoUrls: string[];
  onPickFile: (file: File) => void;
  onRemoveUrl: (url: string) => void;
  disabled?: boolean;
  maxPhotos?: number;
  /** Reject files larger than this before reading as data URL (default 20 MB). */
  maxFileBytes?: number;
};

function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-zinc-900"
      aria-hidden="true"
    >
      <path
        d="M4 7h3l1.5-2h7L17 7h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function PhotoUploader({
  label,
  photoUrls,
  onPickFile,
  onRemoveUrl,
  disabled,
  maxPhotos = Infinity,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
}: Props) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const canAddMore = photoUrls.length < maxPhotos;
  const maxMbLabel = Math.round(maxFileBytes / (1024 * 1024));

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium text-zinc-900">{label}</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {photoUrls.map((url) => (
          <div key={url} className="relative">
            <button
              type="button"
              className="group relative block w-full overflow-hidden rounded-xl text-left outline-none ring-zinc-900 focus-visible:ring-2"
              onClick={() => setPreviewSrc(url)}
              aria-label="Open photo full screen"
            >
              <div className="relative h-52 w-full sm:h-64">
                <img
                  src={url}
                  alt="Location photo"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white">
                Full view
              </div>
            </button>
            <button
              type="button"
              className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveUrl(url);
              }}
              disabled={disabled}
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ))}

        {canAddMore ? (
          <label
            className={[
              "group relative flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm text-zinc-700",
              "hover:bg-zinc-100 focus-within:ring-2 focus-within:ring-zinc-900",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  if (e.target) e.target.value = "";
                  return;
                }
                if (file.size > maxFileBytes) {
                  setFileError(`File is too large (max ${maxMbLabel} MB). Try a smaller image.`);
                  if (e.target) e.target.value = "";
                  return;
                }
                setFileError(null);
                onPickFile(file);
                if (e.target) e.target.value = "";
              }}
              disabled={disabled}
              aria-label="Upload photo"
            />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-900 shadow-sm">
                <CameraIcon />
              </div>
              <div>
                <div className="text-sm font-medium">Add photo</div>
                <div className="text-xs text-zinc-600">PNG, JPG, WEBP · max {maxMbLabel} MB</div>
              </div>
            </div>
          </label>
        ) : null}
      </div>

      {fileError ? (
        <div className="text-sm text-red-700" role="alert">
          {fileError}
        </div>
      ) : null}

      {photoUrls.length === 0 ? (
        <div className="text-sm text-zinc-500">No photos uploaded yet.</div>
      ) : null}

      <Lightbox
        src={previewSrc ?? ""}
        alt="Location photo"
        isOpen={previewSrc !== null}
        onClose={() => setPreviewSrc(null)}
      />
    </div>
  );
}
