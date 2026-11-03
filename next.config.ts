import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // sharp ships builds for every platform; Vercel's functions run on
  // glibc Linux x64, so the musl and WebAssembly builds (about 28 MB per
  // deployment) are dead weight that counts toward function storage.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@img/sharp-libvips-linuxmusl-x64/**",
      "node_modules/@img/sharp-linuxmusl-x64/**",
      "node_modules/@img/sharp-wasm32/**",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/studio", destination: "/studio/briefs", permanent: false }];
  },
};

export default nextConfig;
