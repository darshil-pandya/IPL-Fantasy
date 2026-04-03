import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/teams", label: "Teams" },
  { to: "/players", label: "Players" },
  { to: "/matches", label: "By match" },
  { to: "/auction", label: "Auction" },
  { to: "/rules", label: "Rules" },
] as const;

function NavItems({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Main">
      <ul className="flex items-center justify-around gap-1 md:justify-end md:gap-2">
        {nav.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "block rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:rounded-xl sm:px-3 md:px-4 md:text-sm",
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
