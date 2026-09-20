import Brand from './Brand';
import { MobileNavigation, WorkspaceLink } from './Interactions';

export function PublicHeader() {
  return <><a className="public-skip" href="#main">Skip to content</a>
    <header className="public-header"><div className="public-container header-inner">
      <Brand /><nav className="desktop-navigation" aria-label="Main navigation"><a href="/#how-it-works">How it works</a><a href="/#operations">The details</a><a href="/#for-you">Who it’s for</a></nav>
      <div className="header-actions"><WorkspaceLink /><a className="public-button" href="/register">Get started <span aria-hidden="true">↗</span></a></div><MobileNavigation />
    </div></header></>;
}

export function PublicFooter() {
  return <footer className="public-container public-footer"><div><Brand /><p>Cleaning without the managing.</p></div>
    <nav aria-label="Footer navigation"><a href="/airbnb-cleaning">Airbnb cleaning</a><a href="/software/airbnb-cleaning">Cleaning software</a><a href="/cleaners/airbnb-cleaning-jobs">Cleaner opportunities</a><a href="/login">Log in</a><a href="/register">Get started</a></nav>
    <small>© {new Date().getFullYear()} Turnli</small></footer>;
}
