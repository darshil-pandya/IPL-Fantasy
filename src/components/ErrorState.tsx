export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
      <p className="text-sm text-red-800">{message}</p>
      <button type="button" onClick={onRetry} className="app-btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
