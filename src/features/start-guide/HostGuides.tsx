"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "../dashboard/useWorkspace";
import StartGuide from "./StartGuide";
export default function HostGuides() {
  const m = useWorkspace();
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (await m.save({ action: "property", name, phone: "", notes: "" })) setName("");
  }
  return (
    <div>
      <h3>Property Start Guide</h3>
      <p>Choose a property to manage its operational instructions.</p>
      <p role="status">{m.status}</p>
      {m.conflict && <button className="back" onClick={() => void m.load()}>Reload properties</button>}
      {m.ready && <>
        <label className="field">Property
          <select value={m.selected} disabled={m.busy} onChange={(event) => {
            if (!dirty || confirm("Discard unsaved Start Guide changes and switch property?")) { setDirty(false); m.setSelected(event.target.value); }
          }}>
            <option value="">Choose a property</option>
            {m.state.data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
        <details><summary>Add a property</summary>
          <form onSubmit={create}>
            <label className="field">Property name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <button className="back" disabled={m.busy || dirty}>Create property</button>
          </form>
        </details>
        {m.property ? <StartGuide key={m.property.id} propertyId={m.property.id} editable onDirtyChange={setDirty} /> : <p>Add or choose a property to create its Start Guide.</p>}
      </>}
    </div>
  );
}
