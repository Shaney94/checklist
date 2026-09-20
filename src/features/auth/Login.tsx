'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Brand from '../marketing/Brand';
import { AccountError, loginDestination, policyMessage, requestAccount, type PasswordPolicy } from './client';

type Screen = 'password' | 'register' | 'code';
const defaultPolicy: PasswordPolicy = { minLength: 8 };

export default function Login({ initialScreen = 'password' }: { initialScreen?: 'password' | 'register' }) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [role, setRole] = useState<'host' | 'cleaner' | ''>('');
  const [invited, setInvited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [reset, setReset] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const invitationToken = useRef('');
  const [hasInvitationLink, setHasInvitationLink] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [now, setNow] = useState(0);
  const [policy, setPolicy] = useState(defaultPolicy);
  const [intro, setIntro] = useState('Log in to manage your properties and cleaning.');
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const registerRef = useRef<HTMLInputElement>(null);
  const destination = useRef('/app');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    destination.current = loginDestination(location.search, location.hash);
    const token = params.get('t');
    if (token) { invitationToken.current = token; setHasInvitationLink(true); params.delete('t'); history.replaceState(null, '', location.pathname + '?' + params.toString()); }
    if (params.has('join') || token) { setInvited(true); setRole('cleaner'); }
    if (params.has('join')) setIntro('Welcome to Turnli. Sign in with your invited email, then accept the property invitation in your workspace. You can set your own password using Forgot password.');
    if (params.has('reset')) setIntro('To set or change your password, enter your email and choose Forgot password. We’ll verify it with a code.');
    const controller = new AbortController();
    fetch('/api/account', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(r => r.json()).then(data => { if (data.user && !token && !params.has('reset')) location.replace(destination.current); })
      .catch(error => { if (error.name !== 'AbortError') setStatus('We couldn’t check your session. You can try logging in below.'); });
    fetch('/api/account?action=policy', { cache: 'no-store', signal: controller.signal })
      .then(r => r.json()).then(data => { if (data.policy) setPolicy(data.policy); }).catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 1000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (screen === 'code') codeRef.current?.focus();
    if (screen === 'register') registerRef.current?.focus();
  }, [screen]);

  const seconds = Math.max(0, Math.ceil((cooldown - now) / 1000));
  function enterCode(isReset: boolean, codeSent = false) {
    setReset(isReset); setSent(codeSent); setScreen('code');
    if (screen !== 'code') { setPassword(''); setConfirmation(''); }
  }
  function showLogin() {
    setScreen('password'); setRecovery(false); setStatus(''); setPassword(''); setConfirmation(''); setCode('');
    setIntro('Log in to manage your properties and cleaning.');
    setTimeout(() => emailRef.current?.focus(), 0);
  }
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus(''); setRecovery(false);
    try { await action(); }
    catch (error) {
      if (error instanceof AccountError) {
        setRecovery(error.nextAction === 'verify-existing');
        if (error.retryAfter) { setNow(Date.now()); setCooldown(Date.now() + error.retryAfter * 1000); }
      }
      setStatus(error instanceof Error ? error.name === 'TimeoutError' ? 'The request timed out. Check your connection and try again.' : error.message : 'Please try again.');
    } finally { locked.current = false; setBusy(false); }
  }
  async function deliverCode() {
    if (Date.now() < cooldown) throw new Error('Please wait before requesting another code.');
    await requestAccount({ action: 'send-code', email: email.trim() });
    setNow(Date.now()); setCooldown(Date.now() + 60000); setSent(true);
  }
  function sendCode(isReset: boolean) {
    if (screen === 'password' && !emailRef.current?.reportValidity()) return;
    void run(async () => { await deliverCode(); enterCode(isReset, true); });
  }
  function login(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const result = await requestAccount({ action: 'password-login', email: email.trim(), password });
      if (result.verificationRequired) { enterCode(false); await deliverCode(); return; }
      location.replace(destination.current);
    });
  }
  function register(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (password !== confirmation) throw new Error('The passwords do not match.');
      try { await requestAccount({ action: 'register', email: email.trim(), password, role }); }
      catch (error) {
        if (error instanceof AccountError && error.nextAction === 'setup-required') throw error;
        if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'TypeError' || (error instanceof AccountError && error.status >= 500))) {
          enterCode(false); setCooldown(0);
          setStatus('We couldn’t confirm the signup response. Your account may have been created. If Resend code asks you to log in, choose Back and use the password you just created to resume verification.');
          return;
        }
        throw error;
      }
      enterCode(false); setCooldown(0); setStatus('Account created. Sending your verification code…');
      try {
        // Account creation and delivery are separate: delivery failures stay on verification.
        await requestAccount({ action: 'send-code', email: email.trim() });
        setNow(Date.now()); setCooldown(Date.now() + 60000); setSent(true);
        setStatus('Account created. Enter your code to finish verification.');
      } catch (error) {
        throw new Error('Your account was created, but we couldn’t confirm that the verification code was sent. Use Resend code to try again. ' + (error instanceof Error ? error.name === 'TimeoutError' ? 'The email request timed out.' : error.message : ''));
      }
    });
  }
  function verify(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (reset && password !== confirmation) throw new Error('The passwords do not match.');
      await requestAccount({ action: reset ? 'set-password' : 'verify-code', email: email.trim(), code, ...(reset ? { password } : {}) });
      location.replace(destination.current);
    });
  }
  const title = screen === 'password' ? 'Welcome back' : screen === 'register' ? 'Create your account' : reset ? 'Set your password' : 'Check your email';
  const description = screen === 'password' ? intro : screen === 'register' ? 'Your properties and cleaning, in one place.' : reset ? 'Verify your email to securely set or reset your password.' : 'Use the newest code in your inbox. Check junk mail too.';
  return <div className="auth-page">
    <header className="auth-header"><Brand /><a href="/" className="auth-home">Back to home <span aria-hidden="true">↗</span></a></header>
    <main className="auth-layout">
    <aside className="auth-story" aria-label="Turnli"><p className="eyebrow">Cleaning without the managing.</p><h2>Less to juggle.<br /><span>More in hand.</span></h2><p>Your properties, your cleaning and the details that matter. Together in one workspace.</p><div className="auth-story-note">From the next planned clean<br />to the final review.</div></aside>
    <div className="auth-form-wrap">
    <section className="card" aria-labelledby="loginTitle" aria-busy={busy}>
      <h1 id="loginTitle">{title}</h1><p id="loginIntro">{description}</p>
      {hasInvitationLink && <button className="primary" disabled={busy} onClick={() => void run(async () => { await requestAccount({ action: 'invite-login', token: invitationToken.current }); invitationToken.current = ''; setHasInvitationLink(false); location.replace(destination.current); })}>Continue with secure email link</button>}
      {screen === 'password' && <form id="passwordForm" onSubmit={login}>
        <label htmlFor="loginEmail">Email address</label><input ref={emailRef} id="loginEmail" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="loginPassword">Password</label><input id="loginPassword" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} />
        <button disabled={busy} type="submit" className="primary">Log in →</button>
        <button disabled={busy} id="forgotPassword" className="text-button" type="button" onClick={() => sendCode(true)}>Forgot password?</button>
        <p className="helper">New to Turnli? <button disabled={busy} type="button" className="text-button" id="createAccount" onClick={() => { setScreen('register'); setPassword(''); setConfirmation(''); setStatus(''); }}>Create an account</button></p>
        <div className="divider">or</div><button disabled={busy} id="emailLoginCode" className="secondary" type="button" onClick={() => sendCode(false)}>Email me a login code</button>
      </form>}
      {screen === 'register' && <form id="registerForm" onSubmit={register}>
        {invited ? <p>You’re joining as a Cleaner. Sign in with your invited email to accept Host-assigned work.</p> : <fieldset className="registration-role"><legend>How will you use Turnli?</legend>
          <label><input type="radio" name="role" value="host" required checked={role === 'host'} onChange={() => setRole('host')} /> I’m a Host</label>
          <label><input type="radio" name="role" value="cleaner" required checked={role === 'cleaner'} onChange={() => setRole('cleaner')} /> I’m a Cleaner</label>
        </fieldset>}
        <label htmlFor="registerEmail">Email address</label><input ref={registerRef} id="registerEmail" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="registerPassword">Password</label><input id="registerPassword" type="password" autoComplete="new-password" required minLength={policy.minLength} maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} aria-describedby="registerRequirements" />
        <p className="helper" id="registerRequirements">{policyMessage(policy)}</p>
        <label htmlFor="registerConfirm">Confirm password</label><input id="registerConfirm" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        <button disabled={busy} className="primary" type="submit">Create account →</button><p className="helper">Already have an account? <button disabled={busy} className="text-button" id="registrationLogin" type="button" onClick={showLogin}>Log in</button></p>
      </form>}
      {screen === 'code' && <form id="codeForm" onSubmit={verify}>
        <p id="codeSentTo">{sent ? 'Code sent to ' + email.trim() + '.' : 'Verify ' + email.trim() + '.'}</p>
        <label htmlFor="loginCode">Email code</label><input ref={codeRef} id="loginCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value)} />
        {reset && <div id="newPasswordFields">
          <label htmlFor="newPassword">New password</label><input id="newPassword" type="password" autoComplete="new-password" minLength={policy.minLength} maxLength={1024} required value={password} onChange={e => setPassword(e.target.value)} aria-describedby="passwordRequirements" />
          <p id="passwordRequirements" className="helper">{policyMessage(policy)}</p>
          <label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        </div>}
        <button disabled={busy} type="submit" className="primary" id="verifyLogin">{reset ? 'Save password and log in' : 'Log in →'}</button>
        <div className="code-actions"><button disabled={busy || seconds > 0} type="button" id="resendCode" className="text-button" onClick={() => sendCode(reset)}>{seconds ? `Resend code (${seconds}s)` : 'Resend code'}</button><button disabled={busy} type="button" id="backToPassword" className="text-button" onClick={showLogin}>Log in with password</button></div>
      </form>}
      {recovery && <div id="registrationRecovery"><button disabled={busy} className="secondary" type="button" id="continueRegistration" onClick={showLogin}>Log in to continue</button></div>}
      <p id="loginStatus" role="status" aria-live="polite">{status}</p>
    </section><p className="tagline">Your workspace. A clearer way to work.</p></div>
  </main></div>;
}
