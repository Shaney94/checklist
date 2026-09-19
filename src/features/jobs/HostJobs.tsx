"use client";
import { useEffect, useState, type FormEvent } from "react";
import { request, message } from "../dashboard/api";
import { useWorkspace } from "../dashboard/useWorkspace";
import type { Job } from "./types";
export default function HostJobs() {
  const m = useWorkspace();
  const [jobs, setJobs] = useState<Job[]>([]), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [date, setDate] = useState(""), [kind, setKind] = useState("regular"), [filter, setFilter] = useState("");
  async function load() {
    try { setJobs((await request<{ jobs: Job[] }>("/api/cleaning-jobs")).jobs); setStatus(""); }
    catch (e) { setJobs([]); setStatus(message(e)); }
  }
  useEffect(() => { void load(); }, []);
  async function mutate(body: object) {
    setBusy(true); setStatus("");
    try { await request("/api/cleaning-jobs", body); await load(); setStatus("Job saved."); return true; }
    catch (e) { setStatus(message(e)); return false; }
    finally { setBusy(false); }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    await mutate({ action: "create", propertyId: m.selected, date, kind });
  }
  return <div className="job-workspace">
    <p>Create cleaning work explicitly. Reservation dates do not confirm checkout or create jobs.</p>
    <p role="status">{status || m.status}</p>
    <button className="back" disabled={busy} onClick={() => void load()}>Reload jobs</button>
    <form onSubmit={create}>
      <label className="field">Property<select required value={m.selected} onChange={e => m.setSelected(e.target.value)}>
        <option value="">Choose a property</option>{m.state.data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label className="field">Scheduled cleaning date<input required type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="field">Clean type<select value={kind} onChange={e => setKind(e.target.value)}><option value="regular">Regular clean</option><option value="deep">Deep clean</option></select></label>
      <p>Tasks are copied from the property’s clean list when you create the job.</p>
      <button className="primary" disabled={busy || !m.property}>Create cleaning job</button>
    </form>
    <label className="field">Filter jobs by property<input type="search" value={filter} onChange={e => setFilter(e.target.value)} /></label>
    {jobs.filter(j => j.propertyName.toLowerCase().includes(filter.toLowerCase())).map(job => <JobCard key={job.id + job.revision} job={job} busy={busy} mutate={mutate} />)}
    {!jobs.length && <p>No cleaning jobs yet.</p>}
  </div>;
}
function JobCard({ job, busy, mutate }: { job: Job; busy: boolean; mutate: (body: object) => Promise<boolean> }) {
  const [code, setCode] = useState("");
  return <section className="section">
    <h3>{job.propertyName}</h3><p><time dateTime={job.date}>{job.date}</time> · {job.kind === "deep" ? "Deep" : "Regular"} clean · {job.state === "cancelled" ? "Cancelled" : job.assigned ? "Cleaner assigned" : "Unassigned"}</p>
    {job.state === "scheduled" && <>
      <form autoComplete="off" onSubmit={async e => { e.preventDefault(); if (await mutate({ action: "assign", id: job.id, revision: job.revision, code: code.trim() })) setCode(""); }}>
        <label className="field">Private Cleaner assignment code<input required spellCheck={false} autoCapitalize="none" maxLength={43} value={code} onChange={e => setCode(e.target.value)} /></label>
        <button className="back" disabled={busy}>{job.assigned ? "Replace assigned Cleaner" : "Assign Cleaner"}</button>
      </form>
      {job.assigned && <button className="back" disabled={busy} onClick={() => void mutate({ action: "unassign", id: job.id, revision: job.revision })}>Remove assignment</button>}
      <button className="back" disabled={busy} onClick={() => { if (confirm("Cancel this job and remove Cleaner access?")) void mutate({ action: "cancel", id: job.id, revision: job.revision }); }}>Cancel job</button>
    </>}
  </section>;
}
