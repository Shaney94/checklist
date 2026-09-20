import { PublicHeader, PublicFooter } from './PublicChrome';
import { Motion } from './Interactions';

const steps = [
  ['Link your calendar', 'Bring reservation dates into your property workspace.'],
  ['Plan the turnover', 'A linked reservation plans the clean after scheduled checkout.'],
  ['Assign your Cleaner', 'Your property’s assigned Cleaner receives upcoming jobs.'],
  ['Follow the checklist', 'Property-specific tasks and a secure Start Guide, together.'],
  ['Capture the clean', 'Complete the checklist and submit 3–6 completion photos.'],
  ['Review the work', 'The Host reviews the evidence, then approves or reports an issue.'],
];
function Arrow() { return <span aria-hidden="true">↗</span>; }
function Check() { return <span className="demo-check" aria-hidden="true">✓</span>; }
export default function Home() {
  return <div className="public-site">
    <Motion /><PublicHeader />
    <main id="main" tabIndex={-1}>
      <section className="public-container marketing-hero" aria-labelledby="hero-title">
        <div className="hero-copy"><p className="eyebrow">Cleaning without the managing.</p><h1 id="hero-title">Happier stays.<br /><em>Less to do.</em></h1>
          <p className="public-lead">From a booked stay to a reviewed clean. Bring your calendar, Cleaner and every little detail together in Turnli.</p>
          <div className="public-actions"><a className="public-button" href="/register">Get started <Arrow /></a><a className="public-button button-outline" href="/quote">Get your cleaning price <Arrow /></a></div>
          <p className="hero-note">Your properties. Your Cleaner. One clear plan.</p>
        </div>
        <figure className="hero-demo" aria-label="Illustrative planned cleaning job">
          <div className="demo-orbit" aria-hidden="true" />
          <div className="demo-window">
            <div className="demo-window-heading"><span>YOUR CLEANING WORKSPACE</span><span className="demo-dot" aria-hidden="true" /></div>
            <div className="demo-calendar"><div className="demo-month"><strong>A stay. A clean. A clear handover.</strong><span aria-hidden="true">↗</span></div><div className="demo-week" aria-hidden="true">{['M','T','W','T','F','S','S'].map((day, i) => <span key={i}>{day}</span>)}</div><div className="demo-dates" aria-hidden="true">{[14,15,16,17,18,19,20].map(day => <span key={day} className={day === 18 ? 'selected-day' : ''}>{day}</span>)}</div><div className="demo-streak">Reservation <span>Scheduled checkout →</span></div></div>
            <div className="demo-job"><div className="demo-job-heading"><span className="demo-icon" aria-hidden="true">✧</span><span><small>NEXT PLANNED CLEAN</small><strong>Regular turnover</strong></span><span className="status-pill">Scheduled</span></div>
              <div className="demo-detail"><Check /><div><strong>Your assigned Cleaner</strong><span>Connected to this property</span></div></div>
              <div className="demo-detail"><Check /><div><strong>The right tasks, ready</strong><span>Property checklist & Start Guide</span></div></div>
              <div className="demo-detail"><span className="demo-circle" aria-hidden="true" /><div><strong>Completion → Host review</strong><span>Checklist and photos, in one place</span></div></div>
            </div>
          </div><figcaption>Illustrative workflow · no live property data</figcaption>
          <div className="demo-floating" aria-hidden="true"><span>↳</span> A little less to keep in your head.</div>
        </figure>
      </section>
      <div className="public-benefits"><div className="public-container"><span>One connected workflow</span><strong>Reservation calendars</strong><span aria-hidden="true">·</span><strong>Detailed checklists</strong><span aria-hidden="true">·</span><strong>Photo evidence</strong><span aria-hidden="true">·</span><strong>Host review</strong></div></div>
      <section id="how-it-works" className="public-container public-section" aria-labelledby="workflow-title">
        <div className="section-intro" data-reveal><div><p className="eyebrow">How it works</p><h2 id="workflow-title">Turnovers,<br />with a clear next step.</h2></div><p>Less piecing things together.<br />A shared plan from reservation to review.</p></div>
        <ol className="workflow-steps" data-reveal>{steps.map(([title, description], i) => <li key={title} style={{ '--step': i } as React.CSSProperties}><span className="step-number">0{i + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
        <p className="workflow-note">Jobs are planned from reservation dates. A scheduled checkout never confirms that a guest has physically left.</p>
      </section>
      <section className="product-band" aria-labelledby="product-title"><div className="public-container product-split">
        <figure className="phone-scene" data-reveal><div className="demo-phone"><div className="phone-speaker" aria-hidden="true" /><div className="phone-top"><span>turnli</span><small>YOUR NEXT CLEAN</small><strong>Everything you need.<br />Right where you need it.</strong></div><div className="phone-content"><div className="phone-task"><Check /><span>Property checklist<small>Tasks tailored to this clean</small></span></div><div className="phone-task"><Check /><span>Start Guide<small>Secure instructions for the property</small></span></div><div className="phone-task"><Check /><span>Report an issue<small>Keep the Host informed in Turnli</small></span></div><div className="phone-submit">Checklist → photos → submit</div></div></div><figcaption>Illustrative Cleaner workflow</figcaption></figure>
        <div data-reveal><p className="eyebrow">One place. Fewer loose ends.</p><h2 id="product-title">A better way to<br />manage cleaning.</h2><p className="public-lead">A clear plan for the Host. A ready-to-use workspace for the Cleaner. The details stay with the property, not scattered across messages.</p>
          <div className="feature-grid"><div><span aria-hidden="true">↗</span><h3>Planned automatically</h3><p>Turn linked reservations into planned cleaning jobs.</p></div><div><span aria-hidden="true">◎</span><h3>Your Cleaner, connected</h3><p>Invite by email and assign at property level.</p></div><div><span aria-hidden="true">✓</span><h3>Evidence in context</h3><p>Review the checklist and photos against the right job.</p></div><div><span aria-hidden="true">≡</span><h3>Details kept together</h3><p>Instructions and reported issues, where they belong.</p></div></div>
          <a className="public-text-link" href="#operations">A closer look at the details <Arrow /></a>
        </div></div></section>
      <section id="operations" className="public-container public-section" aria-labelledby="operations-title"><div className="operations-panel" data-reveal>
        <div><p className="eyebrow">The details make the difference</p><h2 id="operations-title">Good standards.<br />Built into the clean.</h2><p>Give every clean a clear brief. Keep the tasks that apply to your property, and the evidence that shows the work.</p><ul className="operations-list"><li><Check /> Secure, property-specific Start Guide</li><li><Check /> Completion photos before submission</li><li><Check /> Host approval or issue reporting</li><li><Check /> Submitted evidence preserved for review</li></ul></div>
        <div className="template-demo"><div className="template-counts"><div><strong>38</strong><span>Regular Clean tasks</span></div><div><strong>109</strong><span>Deep Clean tasks</span></div></div><p className="template-label">STANDARD TEMPLATES. YOUR PROPERTY.</p><div className="template-row"><span>Detailed cleaning tasks</span><Check /></div><div className="template-row"><span>Property-specific applicability</span><Check /></div><div className="template-row template-highlight"><span>Checklist saved to each job</span><Check /></div><p className="template-note">Mark irrelevant tasks not applicable. Keep progress and completed-clean history intact.</p></div>
      </div></section>
      <section id="for-you" className="public-container public-section use-cases" aria-labelledby="uses-title"><div className="section-intro" data-reveal><div><p className="eyebrow">Flexible for how you work</p><h2 id="uses-title">Your setup.<br />A little more sorted.</h2></div><p>One property or several.<br />Your own Cleaner or your own customers.</p></div><div className="use-case-grid" data-reveal>
        {[
          ['01', 'Short-term rental Hosts', 'Keep your turnovers together.', 'Link a calendar, invite your Cleaner and review completed work in your property workspace.', '/airbnb-cleaning', 'Explore Airbnb cleaning'],
          ['02', 'Property managers', 'A clearer view across properties.', 'Keep calendars, instructions, assigned Cleaners and cleaning jobs organised by property.', '/software/airbnb-cleaning', 'Explore cleaning software'],
          ['03', 'Independent Cleaners', 'Your customers. Your workspace.', 'Manage your own customer properties and calendars, alongside work assigned by Turnli Hosts.', '/cleaners/airbnb-cleaning-jobs/', 'Explore Cleaner opportunities'],
        ].map(([number, title, heading, copy, href, link]) => <article key={number} className="use-case-card"><div className="use-case-art" aria-hidden="true"><span>{number}</span><div className={`property-shape shape-${number}`}><i /><i /><i /><i /></div></div><div className="use-case-copy"><p className="eyebrow">{title}</p><h3>{heading}</h3><p>{copy}</p><a className="public-text-link" href={href}>{link} <Arrow /></a></div></article>)}
      </div></section>
      <section className="final-cta" aria-labelledby="final-title"><div className="public-container" data-reveal><p className="eyebrow">A clearer day starts here</p><h2 id="final-title">Less managing.<br />More getting on with life.</h2><p>Bring your cleaning operations together with Turnli.</p><div className="public-actions"><a className="public-button" href="/register">Get started <Arrow /></a><a className="public-button button-outline" href="/login">Log in</a></div></div></section>
    </main>
    <PublicFooter />
  </div>;
}
