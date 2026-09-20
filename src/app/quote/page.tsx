import { PublicHeader, PublicFooter } from '../../features/marketing/PublicChrome';
import QuoteForm from '../../features/quote/QuoteForm';
import { templates } from '../../../lib/checklist-templates.cjs';
import '../../features/marketing/public.css';
import '../../features/quote/quote.css';

// Per-request rendering preserves the existing nonce-based CSP for interactive forms.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your fixed cleaning price | Turnli', robots: { index: false, follow: false } };
export default function Page() {
  const standards = <section className="quote-standards" aria-label="Turnli cleaning standards"><h3>What’s in your clean?</h3><p>Choose a standard to see the tasks. Tasks that don’t apply to your property can be excluded in your workspace.</p>{(['regular', 'deep'] as const).map(kind => <details key={kind}><summary>{kind === 'regular' ? 'Regular Clean' : 'Deep Clean'} · {templates[kind].length} tasks</summary><ol>{templates[kind].map((task: string) => <li key={task}>{task}</li>)}</ol></details>)}</section>;
  return <div className="public-site quote-page"><PublicHeader /><main id="main" tabIndex={-1} className="public-container"><header className="quote-heading"><p className="eyebrow">A clear price before an account</p><h1>Get your<br /><em>cleaning price.</em></h1><p className="public-lead">Tell us about the property. See your fixed Regular or Deep cleaning price, with supplies and normal laundry included.</p></header><QuoteForm standards={standards} counts={{ regular: templates.regular.length, deep: templates.deep.length }} /></main><PublicFooter /></div>;
}
