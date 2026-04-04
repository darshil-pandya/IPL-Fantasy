import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/teams", label: "Teams" },
  { to: "/matches", label: "Match Center" },
  { to: "/predictions", label: "Predictions" },
  { to: "/players", label: "Players" },
  { to: "/waivers", label: "Waivers" },
  { to: "/auction", label: "Auction" },
  { to: "/rules", label: "Rules" },
] as const;

function NavItems({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Main">
      <ul className="flex max-w-[100vw] flex-nowrap items-center justify-start gap-1 overflow-x-auto pb-1 md:max-w-none md:flex-wrap md:justify-end md:gap-2 md:overflow-visible md:pb-0">
        {nav.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "block shrink-0 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors sm:rounded-xl sm:px-2.5 md:px-3 md:text-sm",
                  isActive
                    ? "bg-emerald-600/30 text-amber-200"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                ].join(" ")
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-3 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))] font-sans md:px-6 md:pb-8">
      <header className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-amber-400/90">
            Franchise league
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            IPL Fantasy
          </h1>
        </div>
        <NavItems className="hidden md:block" />
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <NavItems />
      </div>
    </div>
  );
}
