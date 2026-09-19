"use client";
import { useState } from "react";
import { useWorkspace } from "../dashboard/useWorkspace";
import WorkspaceTools from "../dashboard/WorkspaceTools";
import PropertyAssignment from "./PropertyAssignment";
import type { Kind } from "../dashboard/types";
export default function HostProperties({ host = true }: { host?: boolean }) {
  const m = useWorkspace();
  const [name, setName] = useState(""), [kind, setKind] = useState<Kind | null>(null), [search, setSearch] = useState("");
  return <div>
    <p>{host ? "Manage properties and invite their Cleaner. Keep access instructions in the Property Start Guide under Cleaning setup." : "Manage your own customer properties and cleaning lists. Host-assigned properties stay separate."}</p>
    <p role="status">{m.status}</p>
    {m.conflict && <button className="back" onClick={() => void m.load()}>Reload properties</button>}
    <form onSubmit={async e => { e.preventDefault(); if (await m.save({ action: "property", name, phone: "", notes: "" })) setName(""); }}>
      <label className="field">New property name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><button className="primary" disabled={m.busy || !m.ready}>Create property</button>
    </form>
    <label className="field">Find a property<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <label className="field">Property<select value={m.selected} onChange={e => { m.setSelected(e.target.value); setKind(null); }}><option value="">Choose a property</option>{m.state.data.properties.filter(p => p.id === m.selected || p.name.toLowerCase().includes(search.toLowerCase())).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {m.property && <>
      {host && <PropertyAssignment key={m.property.id} propertyId={m.property.id} />}
      <form key={m.property.id + m.property.name} onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void m.save({ action: "property", id: m.property!.id, name: data.get("name"), phone: m.property!.phone, notes: m.property!.notes }); }}>
        <label className="field">Property name<input required name="name" maxLength={100} defaultValue={m.property.name} /></label><button className="back" disabled={m.busy}>Save property name</button>
      </form>
      <div className="dialog-actions">{(["regular", "deep", "faqs"] as Kind[]).map(k => <button className="back" key={k} onClick={() => setKind(k)}>{k === "faqs" ? "FAQs" : k === "regular" ? "Regular Clean List" : "Deep Clean List"}</button>)}</div>
      {kind && <WorkspaceTools key={m.property.id + kind} model={m} kind={kind} onClose={() => setKind(null)} setupOnly={host} />}
    </>}
  </div>;
}
