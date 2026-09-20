import type { NextConfig } from 'next';

const config: NextConfig = {
  // This public URL keeps its trailing slash; preserve Next's normal behaviour elsewhere.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      { source: '/:path(cleaners/airbnb-cleaning-jobs$)', destination: '/cleaners/airbnb-cleaning-jobs/', permanent: true },
      { source: '/:path((?!cleaners/airbnb-cleaning-jobs/$).+)/', destination: '/:path', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
    ];
  },
  serverExternalPackages: ['@descope/node-sdk', '@neondatabase/serverless'],
  outputFileTracingIncludes: {
    '/api/dashboard-bootstrap': ['./private/cleaning-content.enc'],
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }, ...['/login', '/register', '/app/:path*', '/api/:path*'].map(source => ({ source, headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
      { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
    ] }))];
  },
};
export default config;
