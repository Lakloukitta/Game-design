export function TestModeBanner() {
  // Public hint only; the server flag is authoritative for actual behavior.
  const mock = process.env.NEXT_PUBLIC_TRAVEL_APP_MOCK_MODE === 'true';
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="rounded bg-amber-200 px-2 py-0.5 font-semibold uppercase tracking-wide">
        Sandbox demo
      </span>
      <span>Developer test mode: no real payment or travel booking.</span>
      {mock && (
        <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
          Local mock inventory
        </span>
      )}
    </div>
  );
}
