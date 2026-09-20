"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request, message } from "../dashboard/api";
import { useCalendar } from "../calendar/useCalendar";
import CleaningCalendar from "../calendar/CleaningCalendar";
import StartGuide from "../start-guide/StartGuide";
import Dialog from "../../components/Dialog";
type Assignment = { id: string; propertyId: string; propertyName: string; state: "pending" | "active" };
export default function AssignedProperties({ calendarVisible, onChanged, ownCalendar, userId }: { userId: string; calendarVisible: boolean; onChanged: () => void; ownCalendar: React.ReactNode }) {
  const [items, setItems] = useState<Assignment[]>([]), [selected, setSelected] = useState(""), [own, setOwn] = useState(false), [status, setStatus] = useState(""), [busy, setBusy] = useState(false), [guide, setGuide] = useState(false), [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const hiddenKey = "turnli-hidden-assigned-properties:" + userId;
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(hiddenKey) || "[]"); if (Array.isArray(saved) && saved.every(id => typeof id === "string")) setHidden(saved); } catch {} }, [hiddenKey]);
  function hide(ids: string[]) { setHidden(ids); setGuide(false); try { localStorage.setItem(hiddenKey, JSON.stringify(ids)); } catch {} }
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    try { const data = await request<{ assignments: Assignment[] }>("/api/property-assignments"); if (seq !== sequence.current) return; setLoaded(true); setItems(data.assignments); setSelected(id => data.assignments.some(a => a.id === id && a.state === "active") ? id : data.assignments.find(a => a.state === "active")?.id || ""); setStatus(""); }
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
  if (!calendarVisible) return null;
  return <>
    <section className="section job-workspace assigned-work" aria-label="Assigned work">
      <h2>Assigned work</h2><p>From Turnli Hosts. Linked calendars appear automatically.</p><p role="status">{status}</p>
      {items.filter(a => a.state === "pending").map(a => <div key={a.id}><p>Invitation to clean: <strong>{a.propertyName}</strong></p><button className="primary" disabled={busy} onClick={() => void respond(a.id, "accept")}>Accept invitation</button> <button className="back" disabled={busy} onClick={() => void respond(a.id, "decline")}>Decline</button></div>)}
      {!items.length && !status && <p>{loaded ? "No assigned properties yet. Invitations from your Host will appear here." : "Checking your assigned work…"}</p>}
      {!!active.length && <>{active.length === 1 ? <h3 className="assigned-property-name">{property?.propertyName}</h3> : <label className="field">Assigned property<select value={property?.id || ""} onChange={e => { setSelected(e.target.value); setOwn(false); setGuide(false); }}>{active.map(a => <option key={a.id} value={a.id}>{a.propertyName}</option>)}</select></label>}<div className="assigned-property-actions"><button className="back" aria-label="Read property Start Guide" onClick={() => setGuide(true)}>Start Guide</button>{property && <button className="back" aria-label="Hide this assigned property" onClick={() => hide([...hidden, property.id])}>Hide property</button>}</div></>}
      {!!hidden.length && <button className="back" onClick={() => hide([])}>Show hidden assigned properties</button>}
      {calendarVisible && !!active.length && <div className="dialog-actions"><button className="back" aria-pressed={!own} onClick={() => setOwn(false)}>Assigned work</button><button className="back" aria-pressed={own} onClick={() => setOwn(true)}>My customers</button></div>}
      {status && <button className="back" disabled={busy} onClick={() => void load()}>Try again</button>}
    </section>
    {calendarVisible && (property && !own ? <AssignedCalendar key={property.id} id={property.id} /> : ownCalendar)}
    <Dialog id="assignedPropertyGuide" title="Property Start Guide" open={guide && !!property} onClose={() => setGuide(false)}>{guide && property && <StartGuide key={property.id} propertyId={property.propertyId} assignmentId={property.id} />}<button className="back" onClick={() => setGuide(false)}>Close</button></Dialog>
  </>;
}
function AssignedCalendar({ id }: { id: string }) {
  const calendar = useCalendar(id);
  if (!calendar.connected || !calendar.hasCalendar) return <section className="section job-workspace" aria-label="Assigned calendar"><h2>Assigned property calendar</h2><p role="status">{calendar.status || "Loading assigned reservations…"}</p>{!calendar.busy && !calendar.loaded && <button className="back" onClick={() => void calendar.reload()}>Try again</button>}</section>;
  return <><p className="calendar-help">Read-only reservations · Cleans are planned after scheduled checkout, not confirmation that guests have left.</p><CleaningCalendar model={calendar} content={null} readOnly /></>;
}
