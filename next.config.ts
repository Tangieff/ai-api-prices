import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit .next/standalone so the production image ships server.js plus only the
  // node_modules the server actually traces.
  output: 'standalone',
};

export default nextConfig;
