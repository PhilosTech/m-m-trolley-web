import Link from "next/link";
import { ServerPing } from "@/components/ui/server-ping";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center overflow-x-clip bg-zinc-50 px-4 py-12 text-zinc-950 sm:px-6">
      <ServerPing />
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-col gap-3">
          <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-semibold leading-snug text-zinc-900 ring-1 ring-zinc-200/80">
            Half Marathon Trolley Campaign
          </p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Trolley Stand Schedule
            </h1>
            <p className="mt-1.5 text-pretty text-sm leading-relaxed text-zinc-600">
              Sign up for a shift on the route, or manage locations and sign-ups.
            </p>
          </div>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-xl border border-zinc-200 p-4 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            href="/participant"
          >
            <div className="text-base font-medium">Volunteer</div>
            <div className="mt-1 text-sm text-zinc-600">
              Choose a trolley location and sign up for a shift.
            </div>
          </Link>

          <Link
            className="rounded-xl border border-zinc-200 p-4 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            href="/admin"
          >
            <div className="text-base font-medium">Admin</div>
            <div className="mt-1 text-sm text-zinc-600">
              Manage trolley locations, shifts, and volunteer sign-ups.
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
