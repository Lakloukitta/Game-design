import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="text-ink-muted">The page you were looking for does not exist.</p>
      <Link
        href="/"
        className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        Back to Trip Autopilot
      </Link>
    </main>
  );
}
