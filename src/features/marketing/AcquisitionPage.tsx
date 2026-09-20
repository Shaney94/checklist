import type { ReactNode } from 'react';
import { PublicFooter, PublicHeader } from './PublicChrome';
import { Motion } from './Interactions';
import StructuredData from './StructuredData';
import { ORIGIN, publicPages } from './metadata';
import './public.css';
import './acquisition.css';

export default function AcquisitionPage({ page, parent, children }: { page: typeof publicPages[number]; parent?: typeof publicPages[number]; children: ReactNode }) {
  const breadcrumbs = [publicPages[0], ...(parent ? [parent] : []), page];
  return <div className="public-site acquisition-page">
    <Motion /><PublicHeader />
    <main id="main" tabIndex={-1}>
      <nav className="public-container breadcrumbs" aria-label="Breadcrumb"><ol>{breadcrumbs.map((item, index) => <li key={item.path} aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>{index === breadcrumbs.length - 1 ? item.name : <a href={item.path}>{item.name}</a>}</li>)}</ol></nav>
      {children}
    </main>
    <PublicFooter />
    <StructuredData data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: new URL(item.path, ORIGIN).href })) }} />
  </div>;
}
