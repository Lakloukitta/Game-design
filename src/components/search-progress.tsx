import type { UIPhase } from './use-trip-flow';

const STEPS = ['Search', 'Compare', 'Approve', 'Passenger', 'Confirmation'] as const;

const PHASE_STEP: Record<UIPhase, number> = {
  IDLE: 0,
  VALIDATING: 0,
  SEARCHING: 0,
  PROPOSALS_READY: 1,
  REVALIDATING: 2,
  PRICE_CHANGED: 2,
  PASSENGER_DETAILS: 3,
  BOOKING: 4,
  CONFIRMED: 4,
  PENDING_SUPPLIER: 4,
  EXPIRED: 4,
  FAILED: 4,
};

export function SearchProgress({ phase }: { phase: UIPhase }) {
  const active = PHASE_STEP[phase];
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between gap-1">
        {STEPS.map((label, index) => {
          const isDone = index < active;
          const isActive = index === active;
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span
                aria-current={isActive ? 'step' : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  isActive
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : isDone
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {isDone ? '✓' : index + 1}
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isActive ? 'text-brand-700' : 'text-ink-muted'
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
