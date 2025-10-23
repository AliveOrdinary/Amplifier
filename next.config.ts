/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: Removed 'output: export' to enable middleware and API routes for the tagger system
  // The tagger requires server-side features (authentication, dynamic routes, API endpoints)
  images: {
    unoptimized: true,
    disableStaticImages: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
