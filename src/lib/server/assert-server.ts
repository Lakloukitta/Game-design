/**
 * Build-safe server-only guard.
 *
 * We intentionally avoid the `server-only` package's import here: under Next's
 * App Router, route-handler page-data collection can evaluate that package
 * through a non-"react-server" resolution and throw at build time. This module
 * provides the same protection at runtime — if a privileged module is ever
 * bundled into and executed by client code, it throws in the browser — without
 * breaking `next build`. (The check is a no-op on the server, where there is no
 * `window`.)
 */
if (typeof window !== 'undefined') {
  throw new Error(
    'A server-only module was imported into client code. This module accesses privileged credentials and must never run in the browser.',
  );
}

export {};
