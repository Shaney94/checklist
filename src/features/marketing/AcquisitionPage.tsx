import type { ReactNode } from 'react';
import { PublicFooter, PublicHeader } from './PublicChrome';
import { Motion } from './Interactions';
import StructuredData from './StructuredData';
import { ORIGIN, publicPages } from './metadata';
import './public.css';
import './acquisition.css';

export default function AcquisitionPage({ page, children }: { page: typeof publicPages[number]; children: ReactNode }) {
  return <div className="public-site acquisition-page">
    <Motion /><PublicHeader />
    <main id="main" tabIndex={-1}>
      <nav className="public-container breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">{page.name}</li></ol></nav>
      {children}
    </main>
    <PublicFooter />
    <StructuredData data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: page.name, item: new URL(page.path, ORIGIN).href },
    ] }} />
  </div>;
}
