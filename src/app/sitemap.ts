import type { MetadataRoute } from 'next';
import { ORIGIN, publicPages } from '../features/marketing/metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map(page => ({ url: new URL(page.path, ORIGIN).href }));
}
