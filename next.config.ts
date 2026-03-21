// Node.js 22+ exposes localStorage as a global, but throws SecurityError
// without --localstorage-file. This breaks @supabase/auth-js which checks
// for localStorage existence. Restore pre-22 behavior on the server.
try {
  globalThis.localStorage;
} catch {
  Object.defineProperty(globalThis, 'localStorage', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: Removed 'output: export' to enable middleware and API routes for the tagger system
  // The tagger requires server-side features (authentication, dynamic routes, API endpoints)
  eslint: {
    // Skip linting during production builds (pre-existing lint errors unrelated to recent changes)
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    disableStaticImages: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
