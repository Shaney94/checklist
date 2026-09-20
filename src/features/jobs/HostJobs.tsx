"use client";
import { useEffect, useState, type FormEvent } from "react";
import { request, message } from "../dashboard/api";
import { useWorkspace } from "../dashboard/useWorkspace";
import JobIssues from "./JobIssues";
import Completion from "./Completion";
import Dialog from "../../components/Dialog";
import { stateLabels, type Job } from "./types";
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
    <p>Reservation turnovers are planned automatically for assigned properties with linked calendars. Add manual work below when needed. Scheduled checkout does not prove the guest has left.</p>
    <p role="status">{status || m.status}</p>
    <button className="back" disabled={busy} onClick={() => void load()}>Reload jobs</button>
    <form onSubmit={create}>
      <label className="field">Property<select required value={m.selected} onChange={e => m.setSelected(e.target.value)}>
        <option value="">Choose a property</option>{m.state.data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label className="field">Scheduled cleaning date<input required type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="field">Clean type<select value={kind} onChange={e => setKind(e.target.value)}><option value="regular">Regular clean</option><option value="deep">Deep clean</option></select></label>
      <p>Applicable tasks are copied from the property’s clean list. Its accepted Cleaner assignment is used automatically.</p>
      <button className="primary" disabled={busy || !m.property}>Create cleaning job</button>
    </form>
    <label className="field">Filter jobs by property<input type="search" value={filter} onChange={e => setFilter(e.target.value)} /></label>
    {jobs.filter(j => j.propertyName.toLowerCase().includes(filter.toLowerCase())).map(job => <JobCard key={job.id + job.revision} job={job} busy={busy} mutate={mutate} reload={() => void load()} />)}
    {!jobs.length && <p>No cleaning jobs yet.</p>}
  </div>;
}
function JobCard({ job, busy, mutate, reload }: { job: Job; busy: boolean; mutate: (body: object) => Promise<boolean>; reload: () => void }) {
  const [code, setCode] = useState(""), [completion, setCompletion] = useState(false), [issues, setIssues] = useState(false);
  return <section className="section">
    <h3>{job.propertyName}</h3><p><time dateTime={job.date}>{job.date}</time> · {job.kind === "deep" ? "Deep" : "Regular"} clean · {job.state !== "scheduled" ? stateLabels[job.state] : job.assigned ? "Cleaner assigned" : job.automatic ? "Awaiting Cleaner assignment" : "Unassigned"}</p>
    <p>{job.automatic ? "Automatic reservation turnover" : "Manual clean"}{job.plannedAfter ? " · Planned after " + job.plannedAfter.slice(0, 5) : ""}</p>
    {job.needsAttention && <p role="status">Reservation changed or disappeared after work started. Review the retained clean and arrange any further work manually.</p>}
    {!!job.issueCount && <button className="back" onClick={() => setIssues(true)}>View reported issues ({job.issueCount})</button>}
    {job.state === "scheduled" && <>
      {!job.automatic && <details><summary>Assign this job with a private code</summary><form autoComplete="off" onSubmit={async e => { e.preventDefault(); if (await mutate({ action: "assign", id: job.id, revision: job.revision, code: code.trim() })) setCode(""); }}>
        <label className="field">Private Cleaner assignment code<input required spellCheck={false} autoCapitalize="none" maxLength={43} value={code} onChange={e => setCode(e.target.value)} /></label>
        <button className="back" disabled={busy}>{job.assigned ? "Replace assigned Cleaner" : "Assign Cleaner"}</button>
      </form>
      {job.assigned && <button className="back" disabled={busy} onClick={() => void mutate({ action: "unassign", id: job.id, revision: job.revision })}>Remove assignment</button>}
      </details>}<button className="back" disabled={busy} onClick={() => { if (confirm("Cancel this job and remove Cleaner access?")) void mutate({ action: "cancel", id: job.id, revision: job.revision }); }}>Cancel job</button>
    </>}
    {["awaiting_review", "approved", "issue_reported"].includes(job.state) && <button className="back" onClick={() => setCompletion(true)}>View completion</button>}
    <Dialog id={"issues-" + job.id} title="Clean issues" open={issues} onClose={() => setIssues(false)}>{issues && <JobIssues jobId={job.id} host onChanged={reload} />}<button className="back" onClick={() => setIssues(false)}>Close</button></Dialog>
    <Dialog id={"completion-" + job.id} title="Clean completion" open={completion} onClose={() => setCompletion(false)}>{completion && <Completion jobId={job.id} host onChanged={reload} />}<button className="back" onClick={() => setCompletion(false)}>Close</button></Dialog>
  </section>;
}
