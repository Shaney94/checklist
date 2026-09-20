'use client';

import { useEffect, useRef, useState } from 'react';

export function WorkspaceLink() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    // Legacy checklist bookmarks still enter the shared, server-authorised app.
    if (['#regular', '#deep', '#faq'].includes(location.hash)) {
      location.replace('/login' + location.hash); return;
    }
    const controller = new AbortController();
    fetch('/api/account', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(r => r.ok ? r.json() : null).then(data => setSignedIn(Boolean(data?.user))).catch(() => {});
    return () => controller.abort();
  }, []);
  return <a className="public-login" href={signedIn ? '/app' : '/login'}>{signedIn ? 'Your workspace' : 'Log in'}</a>;
}

export function MobileNavigation() {
  const details = useRef<HTMLDetailsElement>(null);
  return <details className="mobile-navigation" ref={details} onKeyDown={event => {
    if (event.key === 'Escape' && details.current?.open) { details.current.open = false; details.current.querySelector('summary')?.focus(); }
  }}>
    <summary>Menu <span aria-hidden="true">☰</span></summary>
    <nav aria-label="Mobile navigation" onClick={event => { if ((event.target as HTMLElement).closest('a') && details.current) details.current.open = false; }}>
      <a href="/#how-it-works">How it works</a><a href="/#operations">The details</a><a href="/#for-you">Who it’s for</a><a href="/airbnb-cleaning">Airbnb cleaning</a><a href="/software/airbnb-cleaning">Cleaning software</a><a href="/cleaners/airbnb-cleaning-jobs">Cleaner opportunities</a><a href="/login">Log in</a><a href="/register">Get started →</a>
    </nav>
  </details>;
}

export function Motion() {
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const elements = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
    const setup = () => {
      observer?.disconnect();
      elements.forEach(el => el.classList.remove('reveal-pending'));
      if (media.matches || !('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          entry.target.classList.add('revealed'); observer?.unobserve(entry.target);
        }
      }, { threshold: 0.08 });
      elements.forEach(el => {
        // Content is visible without JavaScript; only below-fold content waits.
        if (el.getBoundingClientRect().top >= innerHeight) el.classList.add('reveal-pending');
        observer?.observe(el);
      });
    };
    setup(); media.addEventListener('change', setup);
    return () => { observer?.disconnect(); media.removeEventListener('change', setup); };
  }, []);
  return null;
}
