import type { Metadata } from 'next';
import { ORIGIN } from '../../../lib/account.cjs';

// Match canonical routing, including the Cleaner page's trailing slash. No request-derived hosts.
export const publicPages = [
  { path: '/', name: 'Home', title: 'Turnli — Airbnb cleaning, without the managing', description: 'Bring reservation calendars, Cleaners, detailed checklists and completion photos together. A clearer cleaning workflow for Hosts and Cleaners.' },
  { path: '/airbnb-cleaning', name: 'Airbnb cleaning', title: 'Airbnb cleaning for UK Hosts | Turnli', description: 'Looking for an Airbnb cleaner? Explore Turnli’s growing UK network, or bring your own Cleaner and organise holiday let turnovers, checklists and Host review.' },
  { path: '/software/airbnb-cleaning', name: 'Airbnb cleaning software', title: 'Airbnb cleaning management software | Turnli', description: 'Already have a Cleaner? Manage reservation calendars, planned turnovers, property checklists, issues and completion photos in one Turnli workspace.' },
  { path: '/cleaners/airbnb-cleaning-jobs/', name: 'Airbnb cleaning jobs', title: 'Airbnb cleaning jobs & your Cleaner workspace | Turnli', description: 'Join Turnli free to manage existing Airbnb customers, calendars and cleans. Be part of a growing platform for holiday let cleaning work in the UK.' },
  { path: '/airbnb-cleaning/glasgow', name: 'Glasgow', title: 'Airbnb cleaning Glasgow | Turnli', description: 'Plan Glasgow Airbnb turnovers with detailed checklists, completion photos and Host review. Explore Regular and Deep reference prices or bring your own Cleaner.' },
  { path: '/airbnb-cleaning/edinburgh', name: 'Edinburgh', title: 'Airbnb cleaning Edinburgh | Turnli', description: 'Plan Edinburgh holiday-let changeovers around festival stays, linen turnaround and property access. Get your fixed cleaning price or bring your existing Cleaner.' },
  { path: '/airbnb-cleaning/london', name: 'London', title: 'Airbnb cleaning London | Turnli', description: 'Organise London Airbnb cleaning across flats, houses and serviced accommodation. Get a fixed property price and plan access, travel and multi-property handovers.' },
] as const;

export { ORIGIN };
export function publicMetadata(page: typeof publicPages[number]): Metadata {
  const url = new URL(page.path, ORIGIN).href;
  return {
    title: page.title, description: page.description,
    alternates: { canonical: url }, robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: 'Turnli', locale: 'en_GB', url, title: page.title, description: page.description,
      images: [{ url: `${ORIGIN}/icons/icon-512.png`, width: 512, height: 512, alt: 'Turnli' }] },
    twitter: { card: 'summary', title: page.title, description: page.description, images: [`${ORIGIN}/icons/icon-512.png`] },
  };
}
