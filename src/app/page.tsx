import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Trolley Stand Schedule
          </h1>
          <p className="text-sm text-zinc-600">
            Choose how you want to access the schedule.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-xl border border-zinc-200 p-4 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            href="/participant"
          >
            <div className="text-base font-medium">Participant</div>
            <div className="mt-1 text-sm text-zinc-600">
              Reserve an available time slot.
            </div>
          </Link>

          <Link
            className="rounded-xl border border-zinc-200 p-4 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            href="/admin"
          >
            <div className="text-base font-medium">Admin</div>
            <div className="mt-1 text-sm text-zinc-600">
              Create locations and manage bookings.
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
