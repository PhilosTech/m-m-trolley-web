"use client";

type Tab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  tabs: Tab<T>[];
  activeId: T;
  onChange: (id: T) => void;
};

export function Tabs<T extends string>({ tabs, activeId, onChange }: Props<T>) {
  return (
    <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1">
      {tabs.map((t) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
            aria-label={t.label}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

