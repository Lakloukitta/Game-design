export function Card({
  children,
  className = '',
  highlighted = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { highlighted?: boolean }) {
  return (
    <div
      className={`rounded-xl2 border bg-white p-5 shadow-card ${
        highlighted ? 'border-brand-400 ring-1 ring-brand-200' : 'border-slate-200'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
