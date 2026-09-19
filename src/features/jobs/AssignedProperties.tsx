"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request, message } from "../dashboard/api";
import { useCalendar } from "../calendar/useCalendar";
import CleaningCalendar from "../calendar/CleaningCalendar";
import StartGuide from "../start-guide/StartGuide";
import Dialog from "../../components/Dialog";
type Assignment = { id: string; propertyId: string; propertyName: string; state: "pending" | "active" };
export default function AssignedProperties({ calendarVisible, onChanged, ownCalendar, userId }: { userId: string; calendarVisible: boolean; onChanged: () => void; ownCalendar: React.ReactNode }) {
  const [items, setItems] = useState<Assignment[]>([]), [selected, setSelected] = useState(""), [own, setOwn] = useState(false), [status, setStatus] = useState(""), [busy, setBusy] = useState(false), [guide, setGuide] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const hiddenKey = "turnli-hidden-assigned-properties:" + userId;
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(hiddenKey) || "[]"); if (Array.isArray(saved) && saved.every(id => typeof id === "string")) setHidden(saved); } catch {} }, [hiddenKey]);
  function hide(ids: string[]) { setHidden(ids); setGuide(false); try { localStorage.setItem(hiddenKey, JSON.stringify(ids)); } catch {} }
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    try { const data = await request<{ assignments: Assignment[] }>("/api/property-assignments"); if (seq !== sequence.current) return; setItems(data.assignments); setSelected(id => data.assignments.some(a => a.id === id && a.state === "active") ? id : data.assignments.find(a => a.state === "active")?.id || ""); setStatus(""); }
    catch (e) { if (seq !== sequence.current) return; setItems([]); setSelected(""); setGuide(false); setStatus(message(e)); }
  }, []);
  useEffect(() => {
    void load(); const refresh = () => { setGuide(false); if (document.hidden) { ++sequence.current; setItems([]); setSelected(""); } else void load(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); const timer = setInterval(refresh, 60000);
    return () => { ++sequence.current; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  async function respond(id: string, action: string) {
    if (busy) return; setBusy(true);
    try { await request("/api/property-assignments", { id, action }); setOwn(false); await load(); onChanged(); }
    catch (e) { setStatus(message(e)); }
    finally { setBusy(false); }
  }
  const active = items.filter(a => a.state === "active" && !hidden.includes(a.id)), property = active.find(a => a.id === selected) || active[0];
  return <>
    <section className="section job-workspace" aria-label="Host-assigned properties">
      <h2>Host-assigned properties</h2><p role="status">{status}</p>
      {items.filter(a => a.state === "pending").map(a => <div key={a.id}><p>Invitation to clean: <strong>{a.propertyName}</strong></p><button className="primary" disabled={busy} onClick={() => void respond(a.id, "accept")}>Accept invitation</button> <button className="back" disabled={busy} onClick={() => void respond(a.id, "decline")}>Decline</button></div>)}
      {!items.length && <p>Welcome to Turnli. Add your own customer property and calendar, or ask your Host to invite the email you use to sign in. Invitations appear here after you sign in.</p>}
      {!!active.length && <><label className="field">Assigned property<select value={property?.id || ""} onChange={e => { setSelected(e.target.value); setOwn(false); setGuide(false); }}>{active.map(a => <option key={a.id} value={a.id}>{a.propertyName}</option>)}</select></label><button className="back" onClick={() => setGuide(true)}>Read property Start Guide</button>{property && <button className="back" onClick={() => hide([...hidden, property.id])}>Hide this assigned property</button>}</>}
      {!!hidden.length && <button className="back" onClick={() => hide([])}>Show hidden assigned properties</button>}
      {calendarVisible && !!active.length && <div className="dialog-actions"><button className="back" aria-pressed={!own} onClick={() => setOwn(false)}>Host-assigned calendar</button><button className="back" aria-pressed={own} onClick={() => setOwn(true)}>My customer calendars</button></div>}
      <button className="back" disabled={busy} onClick={() => void load()}>Reload invitations</button>
    </section>
    {calendarVisible && (property && !own ? <AssignedCalendar key={property.id} id={property.id} /> : ownCalendar)}
    <Dialog id="assignedPropertyGuide" title="Property Start Guide" open={guide && !!property} onClose={() => setGuide(false)}>{guide && property && <StartGuide key={property.id} propertyId={property.propertyId} assignmentId={property.id} />}<button className="back" onClick={() => setGuide(false)}>Close</button></Dialog>
  </>;
}
function AssignedCalendar({ id }: { id: string }) {
  const calendar = useCalendar(id);
  return <><p>Read-only reservations shared by your Host. Reservation dates do not confirm physical checkout or create cleaning jobs.</p><CleaningCalendar model={calendar} content={null} readOnly /></>;
}
