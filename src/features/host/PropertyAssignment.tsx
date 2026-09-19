"use client";
import { useCallback, useEffect, useState } from "react";
import { request, message } from "../dashboard/api";
type Assignment = { id: string; email: string; state: string; delivery: string; expiresAt: string };
export default function PropertyAssignment({ propertyId }: { propertyId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]), [email, setEmail] = useState(""), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const data = await request<{ assignments: Assignment[] }>("/api/property-assignments?propertyId=" + encodeURIComponent(propertyId)); setAssignments(data.assignments); }, [propertyId]);
  useEffect(() => { void load().catch(e => setStatus(message(e))); }, [load]);
  async function save(body: object) {
    if (busy) return; setBusy(true); setStatus("");
    try { await request("/api/property-assignments", body); setEmail(""); setStatus("Saved. The Cleaner must sign in and accept before property access is granted."); }
    catch (e) { setStatus(message(e)); }
    finally { await load().catch(() => {}); setBusy(false); }
  }
  return <section aria-label="Property Cleaner">
    <h3>Property Cleaner</h3><p>Invite by email. Once accepted, future jobs use this Cleaner automatically. The Cleaner sets their own password or uses an email login code.</p>
    {assignments.map(a => <div key={a.id}><p>{a.email} · {a.state === "active" ? "Assigned" : new Date(a.expiresAt) < new Date() ? "Invitation expired" : "Awaiting acceptance"}{a.delivery === "failed" ? " · Email delivery not confirmed" : ""}</p><button className="back" disabled={busy} onClick={() => { if (confirm("Revoke this property assignment and its Cleaner access? Submitted evidence will be preserved.")) void save({ action: "revoke", id: a.id }); }}>Revoke assignment</button></div>)}
    {!assignments.length && <form onSubmit={e => { e.preventDefault(); void save({ action: "invite", propertyId, email }); }}><label className="field">Cleaner email<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label><button className="primary" disabled={busy}>Invite Cleaner</button></form>}
    <p role="status">{status}</p><button className="back" disabled={busy} onClick={() => void load().catch(e => setStatus(message(e)))}>Reload assignment</button>
  </section>;
}
