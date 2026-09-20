"use client";
import { useState, useEffect } from "react";
import type { WorkspaceModel } from "../dashboard/useWorkspace";
import WorkspaceTools, { labels } from "../dashboard/WorkspaceTools";
import type { Kind } from "../dashboard/types";
import { useCalendar } from "../calendar/useCalendar";
import CalendarManagement from "../calendar/CalendarManagement";

export default function MyCustomers({ model: m, initiallyAdding = false, onCalendarsChanged, onDirty, names = {} }: { model: WorkspaceModel; initiallyAdding?: boolean; onCalendarsChanged: () => void; names?: Record<string,string>; onDirty?: (dirty:boolean)=>void }) {
  const [adding, setAdding] = useState(initiallyAdding), [name, setName] = useState(""), [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind | null>(null), [manage, setManage] = useState(false);
  useEffect(()=>{onDirty?.(adding&&!!name.trim());},[adding,name,onDirty]);
  const calendar = useCalendar();
  const properties = m.state.data.properties, property = m.property;
  const linked = calendar.calendars.filter(c => c.propertyId === property?.id);
  return <div className="my-customers">
    <p>For customers you manage yourself. Work assigned by a Turnli Host appears separately in Assigned work.</p>
    <p role="status">{m.status}</p>
    {m.conflict && <button className="back" onClick={() => void m.load()}>Try again</button>}
    {!adding && <button className="primary" disabled={!m.ready} onClick={() => setAdding(true)}>Add customer property</button>}
    {adding && <form onSubmit={async e => { e.preventDefault(); if (await m.save({ action: "property", name, phone: "", notes: "" })) { setName(""); setAdding(false); setKind(null); } }}>
      <label className="field">Property label<input autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} aria-describedby="customer-name-help" /></label>
      <p id="customer-name-help" className="calendar-help">Use a short label you’ll recognise, such as “Duke Street”. This is not a postal address.</p>
      <div className="dialog-actions"><button className="primary" disabled={m.busy || !m.ready}>Save customer property</button></div>
    </form>}
    {m.ready && !properties.length && !adding && <p>No customer properties yet. Add one to connect its calendar and use its cleaning lists.</p>}
    {!!properties.length && <>
      {properties.length > 5 && <label className="field">Search my customers<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>}
      <div className="customer-choices" aria-label="Customer properties">{properties.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button className="back" key={p.id} aria-pressed={p.id === m.selected} onClick={() => { m.setSelected(p.id); setKind(null); }}><span>{names[p.id]||p.name}</span></button>)}</div>
      {search && !properties.some(p => p.name.toLowerCase().includes(search.toLowerCase())) && <p>No customer properties match that name.</p>}
      {property && <section aria-label="Customer property details">
        <h3>{names[property.id]||property.name}</h3>
        <details><summary>Edit property label</summary><form key={property.id + property.name} onInput={()=>onDirty?.(true)} onSubmit={async e => { e.preventDefault(); if(await m.save({ action: "property", id: property.id, name: new FormData(e.currentTarget).get("name"), phone: property.phone, notes: property.notes })) onDirty?.(false); }}><label className="field">Property label<input required name="name" maxLength={100} defaultValue={property.name} /></label><button className="back" disabled={m.busy}>Save property label</button></form></details>
        <h4>Reservation calendar</h4><p>{linked.length ? `${linked.length} connected calendar${linked.length === 1 ? "" : "s"}.` : "Connect this customer’s calendar to see their reservations."}</p>
        <p role="status">{calendar.status && !calendar.loaded ? calendar.status : ""}</p>
        <button className="back" onClick={() => setManage(true)}>{linked.length ? "Manage customer calendar" : "Connect customer calendar"}</button>
        <h4>Cleaning lists</h4><p>Use and manage the lists for this customer property.</p>
        <div className="dialog-actions">{(["regular", "deep"] as Kind[]).map(k => <button className="back" key={k} onClick={() => setKind(k)}>{labels[k]}</button>)}</div>
        {kind && <WorkspaceTools key={property.id + kind} model={m} displayName={names[property.id]} kind={kind} onClose={() => setKind(null)} />}
        {manage && <CalendarManagement key={property.id} calendars={linked} open onClose={() => setManage(false)} reload={async removed => { await calendar.reload(removed); onCalendarsChanged(); }} refresh={calendar.refresh} propertyContext={{ id: property.id, name: names[property.id]||property.name }} />}
      </section>}
    </>}
  </div>;
}
