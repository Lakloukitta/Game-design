type Tone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<Tone, { wrap: string; icon: string; label: string }> = {
  info: { wrap: 'bg-brand-50 border-brand-200 text-brand-900', icon: 'ℹ', label: 'Information' },
  success: {
    wrap: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: '✓',
    label: 'Success',
  },
  warning: { wrap: 'bg-amber-50 border-amber-200 text-amber-900', icon: '⚠', label: 'Warning' },
  error: { wrap: 'bg-rose-50 border-rose-200 text-rose-900', icon: '✕', label: 'Error' },
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${t.wrap}`} role="status">
      <span aria-hidden="true" className="select-none font-bold">
        {t.icon}
      </span>
      <div className="space-y-1 text-sm">
        {/* Tone is also conveyed by text, never by color alone. */}
        <span className="sr-only">{t.label}: </span>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-current/90">{children}</div>}
      </div>
    </div>
  );
}
