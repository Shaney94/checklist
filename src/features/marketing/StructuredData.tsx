import { headers } from 'next/headers';

export default async function StructuredData({ data }: { data: Record<string, unknown> }) {
  // Keep the existing per-request CSP: no unsafe-inline exception for JSON-LD.
  const nonce = (await headers()).get('Content-Security-Policy')?.match(/'nonce-([^']+)'/)?.[1];
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
