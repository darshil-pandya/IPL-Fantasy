export function LoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-amber-400"
        aria-hidden
      />
      <p className="text-sm">Loading league data…</p>
    </div>
  );
}
