/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The supplier (Duffel) integration is server-only. Ensure these packages are
  // treated as external on the server and never bundled for the browser.
  serverExternalPackages: ['server-only'],
  eslint: {
    // Only lint the application source; the unrelated C game project lives in
    // game-bloodhound-master and must not be linted by Next.
    dirs: ['src'],
  },
};

export default nextConfig;
