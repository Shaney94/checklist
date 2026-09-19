import type { NextConfig } from 'next';

const config: NextConfig = {
  async redirects() {
    return [{ source: '/index.html', destination: '/', permanent: true }];
  },
  serverExternalPackages: ['@descope/node-sdk', '@neondatabase/serverless'],
  outputFileTracingIncludes: {
    '/api/dashboard-bootstrap': ['./private/cleaning-content.enc'],
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
      { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }];
  },
};
export default config;
