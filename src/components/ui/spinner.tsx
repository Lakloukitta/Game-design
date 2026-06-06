export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
      />
      {label && <span>{label}</span>}
    </span>
  );
}
