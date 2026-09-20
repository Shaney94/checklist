"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Dialog from "../../components/Dialog";
import Reminder from "../dashboard/Reminder";
import Account from "../dashboard/Account";
import Sidebar, { Icon } from "../dashboard/Sidebar";
import { request, message, whatsapp } from "../dashboard/api";
import type { User, Kind } from "../dashboard/types";
import { labels } from "../dashboard/WorkspaceTools";
import { today } from "../calendar/useCalendar";
import WorkspaceCalendar from "../calendar/WorkspaceCalendar";
import StartGuide from "../start-guide/StartGuide";
import AssignedProperties from "./AssignedProperties";
import HostProperties from "../host/HostProperties";
import JobIssues from "./JobIssues";
import Completion from "./Completion";
import { stateLabels } from "./types";
import type { Job, AssignedJob } from "./types";
export default function CleanerWorkspace({ user }: { user: User }) {
  const [jobs, setJobs] = useState<Job[]>([]), [selected, setSelected] = useState(""), [job, setJob] = useState<AssignedJob | null>(null);
  const [active, setActive] = useState<Kind | "jobs" | "calendar">("calendar"), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [cant, setCant] = useState(false), [customers, setCustomers] = useState(false);
  const [completionId, setCompletionId] = useState(""), [issueJobId, setIssueJobId] = useState("");
  const [code, setCode] = useState(""), [hasCode, setHasCode] = useState(false), [guide, setGuide] = useState(false);
  const [mobile, setMobile] = useState(false), [more, setMore] = useState(false), [target, setTarget] = useState<HTMLDivElement | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await request<{ jobs: Job[]; hasCode: boolean }>("/api/cleaning-jobs");
      const date = today(), rank = (j: Job) => j.state !== "scheduled" ? 2 : j.date >= date ? 0 : 1;
      result.jobs.sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date) || (a.plannedAfter || "").localeCompare(b.plannedAfter || ""));
      setJobs(result.jobs); setHasCode(result.hasCode); setSelected(id => result.jobs.some(j => j.id === id) ? id : result.jobs[0]?.id || ""); setStatus("");
    } catch (e) { setJobs([]); setSelected(""); setJob(null); setGuide(false); setStatus(message(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const pop = () => { const value = location.hash.replace(/^#(?:tools-)?/, ""); setActive(value === "regular" || value === "deep" ? value : value === "faq" || value === "faqs" ? "faqs" : value === "jobs" ? "jobs" : "calendar"); setMore(false); setGuide(false); };
    pop(); window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop);
  }, []);
  function navigate(value: Kind | "jobs" | "calendar") {
    history.pushState(null, "", location.pathname + (value === "calendar" ? "" : "#" + value)); setActive(value); setMore(false);
  }

  useEffect(() => {
    const media = matchMedia("(max-width:700px)"), resize = () => { setMobile(media.matches); setMore(false); };
    resize(); media.addEventListener("change", resize); return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setJob(null); setGuide(false); setCant(false);
    if (selected) request<AssignedJob>("/api/cleaning-jobs?id=" + encodeURIComponent(selected), undefined, controller.signal).then(setJob).catch(e => { if (!controller.signal.aborted) setStatus(message(e)); });
    return () => controller.abort();
  }, [selected, jobs]);
  useEffect(() => {
    const refresh = () => { setJob(null); setGuide(false); setCode(""); if (!document.hidden) void load(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60000);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  async function generate() {
    if (hasCode && !confirm("Replace your previous assignment code? Existing job assignments stay in place.")) return;
    setBusy(true);
    try { setCode((await request<{ code: string }>("/api/cleaning-jobs", { action: "code" })).code); setHasCode(true); setStatus(""); }
    catch (e) { setStatus(message(e)); } finally { setBusy(false); }
  }
  async function check(index: number, checked: boolean) {
    if (!job || busy || job.state !== "scheduled") return; setBusy(true);
    setJob({ ...job, checked: checked ? [...new Set([...job.checked, index])] : job.checked.filter(i => i !== index) });
    try {
      await request("/api/cleaning-jobs", { action: "check", id: job.id, revision: job.revision, index, checked });
      setJob(await request<AssignedJob>("/api/cleaning-jobs?id=" + encodeURIComponent(job.id))); setStatus("Progress saved.");
    } catch (e) { setJob(null); setGuide(false); setStatus(message(e)); } finally { setBusy(false); }
  }
  const nextJob = jobs.find(j => j.state === "scheduled");
  return <div className="wrap">
    <header className="brand-header"><Image className="brand-mark" src="/icons/turnli.svg" alt="" width={44} height={44} unoptimized /><h1><span className="brand-name">turnli</span> <span className="hub-name">Cleaner Workspace</span></h1><Account user={user} /><button className="nav-item mobile-more" aria-label="More" onClick={() => setMore(true)}><Icon name="more" /></button></header>
    <div className="workspace-frame">
      <Sidebar active={active} navigate={navigate} mobile={mobile} toolsTarget={target} onGuide={() => { setMore(false); setGuide(true); }} />
      <div className="workspace-main">
      <Reminder content={null} visible={active === "jobs" || active === "calendar"} jobs />
      {active === "calendar" && nextJob && <section className="section job-workspace" aria-label="Next clean"><h2>Next clean</h2><p><strong>{nextJob.propertyName}</strong> · <time dateTime={nextJob.date}>{nextJob.date}</time>{nextJob.plannedAfter ? " · Planned after " + nextJob.plannedAfter.slice(0, 5) : ""}</p>{nextJob.automatic && <p>Planned after scheduled checkout. Confirm the property is ready before entering.</p>}<button className="primary" onClick={() => { setSelected(nextJob.id); navigate(nextJob.kind); }}>Open next clean</button></section>}
      <button className="back" onClick={() => setCustomers(true)}>My customer properties & lists</button>
      <AssignedProperties userId={user.id} calendarVisible={active === "calendar"} onChanged={() => void load()} ownCalendar={<WorkspaceCalendar />} />
      {active !== "calendar" && <>
      <main className="section job-workspace">
        <h2>{active === "jobs" ? "Your cleaning jobs" : labels[active]}</h2>
        <p role="status">{status}</p>
        <label className="field">Assigned job<select disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a job</option>{jobs.map(j => <option value={j.id} key={j.id}>{j.date} · {j.propertyName} · {j.kind} clean · {stateLabels[j.state]}</option>)}</select></label>
        {status && !job && <button className="back" disabled={busy} onClick={() => void load()}>Try again</button>}
        {active === "jobs" ? <>
          {!jobs.length && <p>No assigned jobs yet. Accept your Host’s property invitation. Planned cleans appear when its reservation calendar is linked; your Host can also schedule other work.</p>}
          {job && <section><h3>{job.propertyName}</h3><p><time dateTime={job.date}>{job.date}</time> · {job.kind === "deep" ? "Deep" : "Regular"} clean</p><button className="primary" onClick={() => navigate(job.kind)}>Open clean list</button> <button className="back" disabled={job.state !== "scheduled"} onClick={() => setGuide(true)}>Open Start Guide</button></section>}
          <details><summary>Private assignment code</summary><p>Share this code only with Hosts you want to receive work from. It identifies your account for assignment; it cannot sign anyone in or open a property. A new code replaces the old code without changing existing assignments.</p>
            <button className="back" disabled={busy} onClick={() => void generate()}>{hasCode ? "Generate replacement code" : "Generate assignment code"}</button>
            {code && <label className="field">Your assignment code<input readOnly value={code} onFocus={e => e.target.select()} /><span>Copy it now. It is not stored in this browser and cannot be shown again after leaving.</span></label>}
          </details>
          <p className="calendar-help">Manage your own customer calendars in Calendar. Host-assigned work remains separate.</p>
        </> : !job ? <p>Choose an assigned job to see its cleaning tasks and guidance.</p> : active === "faqs" ? <>
          {job.faqs.map((f, i) => <details key={i}><summary>{f.question}</summary><p>{f.answer}</p></details>)}{!job.faqs.length && <p>No FAQs have been added.</p>}
        </> : job.kind !== active ? <p>This job is a {job.kind} clean. Choose a job of the selected clean type.</p> : <div id="workspaceContentView">
          <p>{job.checked.length} of {job.tasks.length} tasks checked</p>
          {job.tasks.map((task, index) => <label key={index}><input type="checkbox" disabled={busy || job.state !== "scheduled"} checked={job.checked.includes(index)} onChange={e => void check(index, e.target.checked)} /><span>{task}</span></label>)}
          {!job.tasks.length && <p>This job has no cleaning tasks. Ask your Host to configure the property list and replace this empty job.</p>}
        </div>}
        {job && active !== "faqs" && <div className="dialog-actions">
          <p>{stateLabels[job.state]} · {job.automatic ? "Reservation turnover" : "Manual clean"}{job.plannedAfter ? " · Planned after " + job.plannedAfter.slice(0, 5) : ""}</p>
          {job.needsAttention && <p role="status">The reservation changed after work started. Confirm the plan with your Host; your saved work is retained.</p>}
          {job.state === "scheduled" && active !== "jobs" && <button className="back" onClick={() => setGuide(true)}>Open Start Guide</button>}
          <button className="back" onClick={() => setIssueJobId(job.id)}>{job.state === "scheduled" ? "Report an issue" : "View reported issues"}</button>
          {job.state === "scheduled" && <button className="back" onClick={() => setCant(true)}>Can’t make this clean</button>}
          <button className="primary" disabled={busy || (job.state === "scheduled" && (!job.tasks.length || job.checked.length !== job.tasks.length))} onClick={() => setCompletionId(job.id)}>{job.state === "scheduled" ? "Complete clean" : "View completion"}</button>
        </div>}
      </main>
      </>}
      </div>
    </div>
    <Dialog id="customerProperties" title="My customer properties & lists" open={customers} onClose={() => setCustomers(false)}>{customers && <HostProperties host={false} />}<button className="back" onClick={() => setCustomers(false)}>Close</button></Dialog>
    <Dialog id="mobileToolsDialog" title="Workspace tools" open={more} onClose={() => setMore(false)}><button className="back" onClick={() => setMore(false)}>Close</button><div ref={setTarget} /></Dialog>
    <Dialog id="cantMakeDialog" title="Can’t make this clean?" open={cant} onClose={() => setCant(false)}>
      <p>Please let your host know as soon as possible so they can arrange another cleaner. This does not cancel the job.</p>
      {job?.hostPhone ? <><a className="primary" target="_blank" rel="noopener noreferrer" href={whatsapp(job.hostPhone, `Hi, I’m unable to make the ${job.kind} clean at ${job.propertyName} scheduled for ${job.date}. Please arrange alternative cover.`)}>Contact host on WhatsApp</a><p>Review the message and press Send in WhatsApp.</p></> : <p>No host contact number is available here. Contact your host directly.</p>}
      <button className="back" onClick={() => setCant(false)}>Close</button>
    </Dialog>
    <Dialog id="jobIssuesDialog" title="Clean issues" open={!!issueJobId} onClose={() => setIssueJobId("")}>{issueJobId && <JobIssues key={issueJobId} jobId={issueJobId} onChanged={() => void load()} />}<button className="back" onClick={() => setIssueJobId("")}>Close</button></Dialog>
    <Dialog id="completionDialog" title="Clean completion" open={!!completionId} onClose={() => setCompletionId("")}>{completionId && <Completion key={completionId} jobId={completionId} onChanged={() => void load()} />}<button className="back" onClick={() => setCompletionId("")}>Close</button></Dialog>
    <Dialog id="startGuideDialog" title="Property Start Guide" open={guide} onClose={() => setGuide(false)}>{guide && (job ? <><h3>{job.propertyName}</h3><StartGuide key={job.id} propertyId={job.propertyId} jobId={job.id} /></> : <p>Choose a verified assigned job to read its Start Guide.</p>)}<button className="back" onClick={() => setGuide(false)}>Close</button></Dialog>
  </div>;
}
