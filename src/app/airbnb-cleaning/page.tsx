import AcquisitionPage from '../../features/marketing/AcquisitionPage';
import { publicMetadata, publicPages } from '../../features/marketing/metadata';

export const metadata = publicMetadata(publicPages[1]);
export default function Page() {
  return <AcquisitionPage page={publicPages[1]}>
    <section className="public-container acquisition-hero" aria-labelledby="cleaning-title">
      <div className="hero-copy"><p className="eyebrow">Airbnb & holiday let cleaning · UK</p><h1 id="cleaning-title">Find reliable Airbnb cleaners <em>near you.</em></h1>
        <p className="public-lead">A fresh start for every stay, with a clear plan behind it. Turnli brings your reservation calendar, Cleaner and cleaning details together.</p>
        <div className="public-actions"><a className="public-button" href="/register">Get started <span aria-hidden="true">↗</span></a><a className="public-text-link" href="/software/airbnb-cleaning">Already have a Cleaner?</a></div>
      </div>
      <aside className="acquisition-note" aria-labelledby="availability-title"><p className="eyebrow">Growing, property by property</p><h2 id="availability-title">Need a Cleaner?</h2><p>We’re building Cleaner availability across the UK. Create your Turnli account to get started; Cleaner availability is still developing and we cannot guarantee a match in your area.</p><p>Already work with someone you trust? With a Host workspace, you can invite them by email and organise your cleans together now.</p></aside>
    </section>
    <section className="public-container public-section acquisition-section" aria-labelledby="turnover-title" data-reveal>
      <p className="eyebrow">More than a date in the diary</p><h2 id="turnover-title">Give every changeover<br />a clear brief.</h2><p className="section-lead">Short-term rental cleaning needs a handover as well as a checklist. Keep the practical details with the property, so the Cleaner can see the work ahead.</p>
      <div className="acquisition-grid">
        <article><h3>Plan around reservations</h3><p>Link the property’s iCal reservation calendar. Turnli plans routine turnover jobs after scheduled checkout and assigns them to the property’s Cleaner. Calendar dates do not confirm that a guest has physically left.</p></article>
        <article><h3>Make the property’s needs clear</h3><p>Use detailed Regular and Deep Clean templates, marking irrelevant tasks not applicable. Keep access instructions, equipment locations and lock-up guidance in an authorised, read-only Start Guide for the Cleaner.</p></article>
        <article><h3>Review the completed work</h3><p>The Cleaner completes the job checklist and submits 3–6 photos. You can review that evidence, approve the clean or report an issue. Submitted evidence stays attached to the job.</p></article>
      </div>
    </section>
    <section className="product-band"><div className="public-container acquisition-split" data-reveal><div><p className="eyebrow">Your Cleaner. Your standards.</p><h2>Already have<br />a reliable Cleaner?</h2></div><div><p>You don’t need to change that relationship. Invite your existing Cleaner to the property in Turnli. They establish their own login and see the calendar, upcoming cleans, checklist and property guidance they’re authorised to use.</p><p>Issues can be reported against the clean, so you can review the problem in context rather than lose the details between messages.</p><a className="public-text-link" href="/software/airbnb-cleaning">See how the cleaning software works <span aria-hidden="true">↗</span></a><p className="related-link">Do this work yourself? <a href="/cleaners/airbnb-cleaning-jobs/">Explore Turnli for Cleaners.</a></p></div></div></section>
    <section className="public-container public-section acquisition-section" aria-labelledby="local-title"><p className="eyebrow">A closer look at your market</p><h2 id="local-title">Planning a clean in Glasgow?</h2><p className="section-lead">Explore reference prices, tenement and apartment handovers, and a clear cleaning brief for your Glasgow property. Cleaner availability is still developing.</p><a className="public-text-link" href="/airbnb-cleaning/glasgow">Explore Airbnb cleaning in Glasgow <span aria-hidden="true">↗</span></a></section>
    <section className="final-cta" aria-labelledby="start-title"><div className="public-container"><p className="eyebrow">A clearer plan for the next stay</p><h2 id="start-title">Bring your cleaning<br />operations together.</h2><p>Start with your account. Bring your existing Cleaner when you’re ready.</p><div className="public-actions"><a className="public-button" href="/register">Get started <span aria-hidden="true">↗</span></a></div></div></section>
  </AcquisitionPage>;
}
