'use client';
import { useCallback, useEffect, useState } from 'react';
import Brand from '../marketing/Brand';
import { request, message } from '../dashboard/api';
import { requestAccount } from './client';
type Invitation = { id: string; propertyName: string };
export default function AccountSetup() {
  const [items, setItems] = useState<Invitation[]>([]), [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { const account = await request<{ user: { authorizationState?: string } | null }>('/api/account'); if (['host', 'cleaner'].includes(account.user?.authorizationState || '')) { location.replace('/app'); return; } const data = await request<{ invitations: Invitation[] }>('/api/property-assignments?action=onboarding'); setItems(data.invitations); setLoaded(true); setStatus(''); }
    catch (error) { setStatus(message(error)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function accept(id: string) {
    if (busy) return; setBusy(true); setStatus('');
    try { await request('/api/property-assignments', { action: 'accept', id }); location.replace('/app'); }
    catch (error) { setStatus(message(error)); setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await requestAccount({ action: 'logout' }); location.replace('/login'); }
    catch { setStatus('We couldn’t sign you out. Please try again.'); setBusy(false); }
  }
  return <main className="auth-page"><header className="auth-header"><Brand /></header><div className="card" style={{ width: "min(480px, calc(100% - 32px))", margin: "24px auto", overflowWrap: "anywhere" }}><h1>Account setup incomplete</h1>
    <p>You’re signed in, but your workspace role has not been confirmed.</p>
    <p>Accept a property invitation below to finish Cleaner setup. Otherwise, contact Turnli support to confirm your account setup. Signing in again or resetting your password does not choose a role.</p>
    <p role="status" aria-live="polite">{status}</p>
    {items.map(item => <div key={item.id}><h2>Invitation to clean: {item.propertyName}</h2><button className="public-button" disabled={busy} onClick={() => void accept(item.id)}>Accept invitation</button></div>)}
    {loaded && !items.length && <p>No pending invitations for your signed-in email. Ask your Host to check the invited email address or contact Turnli support.</p>}
    <button className="public-button" disabled={busy} onClick={() => void load()}>Check setup again</button>{' '}
    <button className="public-text-link" disabled={busy} onClick={() => void logout()}>Sign out</button>
  </div></main>;
}
