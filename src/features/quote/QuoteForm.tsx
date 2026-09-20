'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

type Details = { location: string; bedrooms: number; beds: number; bathrooms: number; sizeUnit: string; size: number | null; kind: string; cleansPerMonth: number | null };
type Quote = { version: string; details: Details; sizeUnknown: boolean; prices: { kind: string; price: number; minutesLow: number; minutesHigh: number }[] };
type SavedQuote = { propertyId: string; workspace: string; quote: Quote };
const draftKey = 'turnli-quote-draft';
export default function QuoteForm({ standards, counts }: { standards: ReactNode; counts: Record<string, number> }) {
  const [unit, setUnit] = useState('m2');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState<{ propertyId: string; workspace: string } | null>(null);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const requestId = useRef('');
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false);
  async function calculate(details: Details) {
    const response = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) {
      setErrorField(response.status === 400 ? data.field || 'form' : 'form');
      throw new Error(response.status === 400 ? data.error : response.status === 403 ? 'This website address isn’t enabled for quotes. Please use turnli.io, or check the local development address configuration.' : 'We couldn’t calculate your price. Please try again.');
    }
    setQuote(data);
    if (form.current) { for (const [key, value] of Object.entries(data.details)) { const control = form.current.elements.namedItem(key); if (control instanceof HTMLInputElement || control instanceof RadioNodeList) control.value = value == null ? '' : String(value); } setUnit(data.details.sizeUnit); }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await fetch('/api/account', { cache: 'no-store' }).then(r => r.json());
        if (!active) return;
        setSignedIn(Boolean(session.user));
        if (session.user) {
          const response = await fetch('/api/quote/save', { cache: 'no-store' });
          if (response.ok) { const data = await response.json(); if (active) setSavedQuotes(data.quotes); }
        }
        const stored = sessionStorage.getItem(draftKey);
        if (!stored) return;
        const draft = JSON.parse(stored);
        if (!Number.isFinite(draft.created) || draft.created > Date.now() || Date.now() - draft.created > 30 * 60 * 1000 || !draft.details || typeof draft.id !== 'string') { sessionStorage.removeItem(draftKey); return; }
        requestId.current = draft.id;
        if (session.user) {
          const response = await fetch('/api/quote/save?id=' + encodeURIComponent(draft.id), { cache: 'no-store' });
          if (response.ok) { const data = await response.json(); if (active) { setQuote(data.quote); setSaved(data); sessionStorage.removeItem(draftKey); } return; }
        }
        if (active) await calculate(draft.details);
      } catch { if (active) setError('If you were returning to a quote, please enter the details again.'); }
    })();
    return () => { active = false; };
  }, []);
  async function continueQuote() {
    if (!quote || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      // Temporary, tab-scoped handoff only after explicit Continue; never the saved source of truth.
      sessionStorage.setItem(draftKey, JSON.stringify({ details: quote.details, created: Date.now(), id: requestId.current }));
      if (!signedIn) { location.assign('/register?next=%2Fquote'); return; }
      const response = await fetch('/api/quote/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: requestId.current, details: quote.details }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (response.status === 401) { location.assign('/login?next=%2Fquote'); return; }
      if (!response.ok) { setError([400,403,409].includes(response.status) ? data.error : 'We couldn’t save your quote. Please try again.'); return; }
      setQuote(data.quote); setSaved(data); setSavedQuotes(previous => [...previous.filter(item => item.propertyId !== data.propertyId), data]); sessionStorage.removeItem(draftKey);
    } catch { setError('We couldn’t keep or save your details. Check your connection and allow temporary session storage, then try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => { if (quote) result.current?.focus(); }, [quote]);
  useEffect(() => {
    if (!error) return;
    const ids: Record<string, string> = { location: 'quote-location', bedrooms: 'quote-bedrooms', beds: 'quote-beds', bathrooms: 'quote-bathrooms', size: 'quote-size', sizeUnit: 'quote-unit', kind: 'quote-kind-regular', cleansPerMonth: 'quote-frequency' };
    const control = document.getElementById(ids[errorField] || 'quote-error');
    if (control && control.getClientRects().length) control.focus();
    else document.getElementById('quote-error')?.focus();
  }, [error, errorField]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setErrorField('');
    const values = new FormData(event.currentTarget);
    const details: Details = { location: String(values.get('location')), bedrooms: Number(values.get('bedrooms')), beds: Number(values.get('beds')), bathrooms: Number(values.get('bathrooms')), sizeUnit: unit, size: unit === 'unknown' ? null : Number(values.get('size')), kind: String(values.get('kind')), cleansPerMonth: values.get('cleansPerMonth') ? Number(values.get('cleansPerMonth')) : null };
    try { await calculate(details); }
    catch (e) { setError(e instanceof Error && !['TypeError', 'TimeoutError', 'SyntaxError'].includes(e.name) ? e.message : 'We couldn’t connect. Check your connection and try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function edit() { requestId.current = ''; try { sessionStorage.removeItem(draftKey); } catch {} setSaved(null); setQuote(null); setError(''); requestAnimationFrame(() => form.current?.querySelector('input')?.focus()); }
  function described(field: string) { return errorField === field ? { 'aria-invalid': true as const, 'aria-describedby': 'quote-error' } : {}; }
  return <div className="quote-flow">
    <p className="quote-error" id="quote-error" role="alert" tabIndex={-1}>{error}</p>
    <div hidden={!!quote}>
      {savedQuotes.length > 0 && <details className="quote-more"><summary>Your saved properties and prices</summary><ul>{savedQuotes.map(item => <li key={item.propertyId}><button className="quote-text-button" onClick={() => { setQuote(item.quote); setSaved(item); }}>{item.quote.details.location} — {item.quote.prices.map(price => `${price.kind === 'regular' ? 'Regular' : 'Deep'} £${price.price}`).join(' · ')}</button></li>)}</ul></details>}
      <form ref={form} onSubmit={submit} aria-busy={busy}>
        <fieldset><legend><span>01</span> Your property</legend><p>For flats, houses, cottages and serviced accommodation. No account needed to see your price.</p>
          <label htmlFor="quote-location">Town, area or postcode</label><input id="quote-location" name="location" required minLength={2} maxLength={160} autoComplete="postal-code" {...described('location')} /><p className="quote-help">A general location is enough. Please don’t enter access codes or private instructions.</p>
          <div className="quote-fields">{[['bedrooms', 'Bedrooms', 0, 12], ['beds', 'Beds', 1, 24], ['bathrooms', 'Bathrooms', 1, 12]].map(([name, label, min, max]) => <div key={name}><label htmlFor={'quote-' + name}>{label}</label><input id={'quote-' + name} name={String(name)} type="number" inputMode="numeric" min={min} max={max} step="1" required {...described(String(name))} /></div>)}</div>
          <label htmlFor="quote-unit">Property size</label><select id="quote-unit" {...described('sizeUnit')} value={unit} onChange={e => setUnit(e.target.value)}><option value="m2">Square metres (m²)</option><option value="ft2">Square feet (ft²)</option><option value="unknown">I don’t know</option></select>
          {unit !== 'unknown' && <><label htmlFor="quote-size">Size in {unit === 'm2' ? 'square metres' : 'square feet'}</label><input id="quote-size" name="size" type="number" inputMode="decimal" required min={unit === 'm2' ? 15 : 162} max={unit === 'm2' ? 500 : 5381} step="any" {...described('size')} /></>}
          <p className="quote-help">Don’t know the size? You can still get a fixed price. Adding size improves quote accuracy.</p>
        </fieldset>
        <fieldset><legend><span>02</span> Your cleaning</legend><div className="quote-choices">{[['regular', 'Regular Clean'], ['deep', 'Deep Clean'], ['both', 'Both']].map(([value, label]) => <label key={value}><input id={'quote-kind-' + value} {...described('kind')} type="radio" name="kind" value={value} defaultChecked={value === 'both'} required />{label}</label>)}</div>
          <label htmlFor="quote-frequency">Approximate cleans per month (optional)</label><input id="quote-frequency" name="cleansPerMonth" type="number" inputMode="numeric" min="0" max="93" step="1" {...described('cleansPerMonth')} /><p className="quote-help">For planning only. Frequency doesn’t change your price.</p>
        </fieldset>
        <button className="public-button" disabled={busy} type="submit">{busy ? 'Calculating…' : 'See your fixed price'} <span aria-hidden="true">↗</span></button>
      </form>
    </div>
    <div aria-live="polite" aria-atomic="true" className="quote-announcement">{quote ? 'Your fixed cleaning price is ready below.' : ''}</div>
    {quote && <section className="quote-result" aria-labelledby="quote-result-title">
      <p className="eyebrow">Your property. Your price.</p><h2 id="quote-result-title" ref={result} tabIndex={-1}>Your fixed cleaning price</h2>
      <p>{quote.details.location} · {quote.details.bedrooms} bedrooms · {quote.details.beds} beds · {quote.details.bathrooms} bathrooms{!quote.sizeUnknown && ` · ${quote.details.size} ${quote.details.sizeUnit === 'm2' ? 'm²' : 'ft²'}`}</p>
      <div className="quote-prices">{quote.prices.map(price => <article key={price.kind}><h3>{price.kind === 'regular' ? 'Regular Clean' : 'Deep Clean'}</h3><p className="quote-amount">£{price.price}</p><p>Approx. {price.minutesLow / 60}{price.minutesHigh !== price.minutesLow ? `–${price.minutesHigh / 60}` : ''} hours</p><p>{counts[price.kind]}-task Turnli cleaning standard</p></article>)}</div>
      <p><strong>Included:</strong> cleaning supplies, normal linen/towel wash and dry, and the Turnli standard cleaning checklist.</p>
      {quote.sizeUnknown && <p className="quote-size-note">Your price uses the details provided without a floor-area figure. Adding property size improves quote accuracy.</p>}
      <p>This fixed price is based on accurate property details. Inaccurate or materially incomplete details may require recalculation. Times are planning estimates. No booking, payment or Cleaner match is made here.</p>
      {!saved && <button className="quote-text-button" onClick={edit}>Edit property details</button>}
      {standards}
      <details className="quote-more"><summary>Tell us more about the property</summary><p>You can add operational instructions and checklist applicability in your authorised property workspace after account creation. Property photos, floor plans and marketplace posting are not available in this quote flow.</p></details>
      <div className="quote-continue">{saved ? <><h3>Property and quote saved.</h3><p>Your property uses the standard Regular and Deep checklists. You can manage its operational details in your workspace. This is not a booking or Cleaner match.</p><a className="public-button" href={saved.workspace}>Open your workspace <span aria-hidden="true">↗</span></a></> : <><h3>Keep your next step simple.</h3><p>{signedIn ? 'Save this property and quote to your workspace. This won’t book a clean or find a Cleaner.' : 'Create an account or log in, then confirm to save your property and quote. Your price is available without signing up.'}</p><button className="public-button" disabled={busy} onClick={() => void continueQuote()}>{busy ? 'Saving…' : signedIn ? 'Save property and quote' : 'Continue with Turnli'} <span aria-hidden="true">↗</span></button><p className="quote-help">Already have an account? You can log in on the next screen. Cleaner availability is still developing; continuing does not guarantee a match.</p></>}</div>
    </section>}
  </div>;
}
