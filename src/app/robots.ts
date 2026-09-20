import type { MetadataRoute } from 'next';
import { ORIGIN } from '../features/marketing/metadata';

export default function robots(): MetadataRoute.Robots {
  // Auth pages remain crawlable so crawlers can see their noindex directives.
  // Private resources are protected by server authorization, not this file.
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/app', '/private/'] }, sitemap: `${ORIGIN}/sitemap.xml` };
}
