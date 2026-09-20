"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Dialog from "../../components/Dialog";
import Reminder from "../dashboard/Reminder";
import Account from "../dashboard/Account";
import Sidebar, { Icon } from "../dashboard/Sidebar";
import { request, message } from "../dashboard/api";
import type { User, Kind } from "../dashboard/types";
import { today } from "../calendar/useCalendar";
import WorkspaceCalendar from "../calendar/WorkspaceCalendar";
import StartGuide from "../start-guide/StartGuide";
import AssignmentCode from './AssignmentCode';
import CleanerLists, { GeneralFAQs, type CleanerProperty } from './CleanerLists';
import { propertyLabels } from '../../../lib/property-labels.cjs';
import AssignedProperties from "./AssignedProperties";
import MyCustomers from "./MyCustomers";
import { useWorkspace } from "../dashboard/useWorkspace";
import "./cleaner-ux.css";
import JobIssues from "./JobIssues";
import Completion from "./Completion";
import { stateLabels } from "./types";
import type { Job, AssignedJob } from "./types";
export default function CleanerWorkspace({ user }: { user: User }) {
  const customerModel = useWorkspace();
  const [customerDirty,setCustomerDirty]=useState(false),[issueDirty,setIssueDirty]=useState(false);
  function closeCustomers(){if(!customerDirty||confirm("Discard unsaved property details?")){setCustomers(false);setCustomerDirty(false);}}
  function closeIssues(){if(!issueDirty||confirm("Discard this unsaved issue?")){setIssueJobId("");setIssueDirty(false);}}
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerCalendarVersion, setCustomerCalendarVersion] = useState(0);
  function openCustomers(adding = false) { setAddingCustomer(adding); setCustomers(true); setMore(false); }
  const [jobs, setJobs] = useState<Job[]>([]), [selected, setSelected] = useState(""), [job, setJob] = useState<AssignedJob | null>(null);
  const [active, setActive] = useState<Kind | "jobs" | "calendar">("calendar"), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [cant, setCant] = useState(false), [customers, setCustomers] = useState(false);
  const [completionId, setCompletionId] = useState(""), [issueJobId, setIssueJobId] = useState("");
  const [guide, setGuide] = useState(false);
  const [properties,setProperties]=useState<CleanerProperty[]>([]),[contextStatus,setContextStatus]=useState("");
  const [guideProperty,setGuideProperty]=useState("");
  const names:Record<string,string>=propertyLabels(properties);
  const propertyName=(p:{propertyId:string;propertyName:string})=>names[p.propertyId]||p.propertyName;
  const [mobile, setMobile] = useState(false), [more, setMore] = useState(false), [target, setTarget] = useState<HTMLDivElement | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await request<{ jobs: Job[]; hasCode: boolean }>("/api/cleaning-jobs");
      const date = today(), rank = (j: Job) => j.state !== "scheduled" ? 2 : j.date >= date ? 0 : 1;
      result.jobs.sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date) || (a.plannedAfter || "").localeCompare(b.plannedAfter || ""));
      setJobs(result.jobs); setSelected(id => result.jobs.some(j => j.id === id) ? id : result.jobs[0]?.id || ""); setStatus("");
    } catch (e) { setJobs([]); setSelected(""); setJob(null); setGuide(false); setStatus(message(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(()=>{let alive=true;const refresh=()=>{if(document.hidden){setProperties([]);return;}request<{properties:CleanerProperty[]}>('/api/cleaning-jobs?action=properties').then(r=>{if(alive){setProperties(r.properties||[]);setContextStatus('');}}).catch(e=>{if(alive){setProperties([]);setContextStatus(message(e));}});};refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=setInterval(refresh,60000);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[jobs,customerModel.state]);
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
    const refresh = () => { setJob(null); setGuide(false); if (!document.hidden) void load(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60000);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  async function check(index: number, checked: boolean) {
    if (!job || busy || job.state !== "scheduled") return; setBusy(true);
    setJob({ ...job, checked: checked ? [...new Set([...job.checked, index])] : job.checked.filter(i => i !== index) });
    try {
      await request("/api/cleaning-jobs", { action: "check", id: job.id, revision: job.revision, index, checked });
      setJob(await request<AssignedJob>("/api/cleaning-jobs?id=" + encodeURIComponent(job.id))); setStatus("Progress saved.");
    } catch (e) { setJob(null); setGuide(false); setStatus(message(e)); } finally { setBusy(false); }
  }
  const nextJob = jobs.find(j => j.state === "scheduled");
  return <div className="wrap cleaner-workspace">
    <header className="brand-header"><Image className="brand-mark" src="/icons/turnli.svg" alt="" width={44} height={44} unoptimized /><h1><span className="brand-name">turnli</span> <span className="hub-name">Cleaner Workspace</span></h1><div className="cleaner-header-actions"><Account user={user} /><button className="nav-item mobile-more" aria-label="More" onClick={() => setMore(true)}><Icon name="more" /></button></div></header>
    <div className="workspace-frame">
      <Sidebar active={active} navigate={navigate} mobile={mobile} toolsTarget={target} onGuide={() => { setMore(false); setGuide(true); }} onCustomers={() => openCustomers()} />
      <main className="workspace-main">
      <Reminder content={null} visible={active === "jobs" || active === "calendar"} jobs />
      {active === "calendar" && nextJob && <section className="section job-workspace" aria-label="Next clean"><h2>Next clean</h2><p><strong>{propertyName(nextJob)}</strong> · <time dateTime={nextJob.date}>{nextJob.date}</time>{nextJob.plannedAfter ? " · Planned after " + nextJob.plannedAfter.slice(0, 5) : ""}</p>{nextJob.automatic && <p>Planned after scheduled checkout. Confirm the property is ready before entering.</p>}<button className="primary" onClick={() => { setSelected(nextJob.id); navigate("jobs"); }}>Open next clean</button></section>}
      {active === "calendar" && status && <p role="status">{status}</p>}
      <AssignedProperties names={names} userId={user.id} calendarVisible={active === "calendar"} onChanged={() => {void load();setCustomerCalendarVersion(v=>v+1);}} ownCalendar={hidden=><WorkspaceCalendar key={customerCalendarVersion} customerView names={names} hiddenProperties={hidden} />} />
      {active === "faqs" && <GeneralFAQs />}
      {(active === 'regular'||active === 'deep')&&<CleanerLists key={active} kind={active} properties={properties} names={names} jobs={jobs} status={contextStatus} onJob={id=>{setSelected(id);navigate('jobs');}} />}
      {active === "jobs" && <>
      <section className="section job-workspace">
        <h2>Your cleaning jobs</h2>
        <p role="status">{status}</p>
        <AssignmentCode />
        <label className="field">Assigned job<select disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a job</option>{jobs.map(j => <option value={j.id} key={j.id}>{j.date} · {propertyName(j)} · {j.kind} clean · {stateLabels[j.state]}</option>)}</select></label>
        {status && !job && <button className="back" disabled={busy} onClick={() => void load()}>Try again</button>}
        {!jobs.length && <p>No assigned jobs yet. Accept your Host’s property invitation in Calendar. My customers manages properties you bring yourself; standard cleaning lists and FAQs are already available.</p>}
        {job && <><h3>{propertyName(job)}</h3><p>{job.date} · {job.kind === 'deep'?'Deep':'Regular'} clean · {job.checked.length} of {job.tasks.length} tasks checked</p><div id="workspaceContentView">{job.tasks.map((task,index)=><label key={index}><input type="checkbox" disabled={busy||job.state!=='scheduled'} checked={job.checked.includes(index)} onChange={e=>void check(index,e.target.checked)} /><span>{task}</span></label>)}</div></>}
        {job && <div className="dialog-actions">
          <p>{stateLabels[job.state]} · {job.automatic ? "Reservation turnover" : "Manual clean"}{job.plannedAfter ? " · Planned after " + job.plannedAfter.slice(0, 5) : ""}</p>
          {job.needsAttention && <p role="status">The reservation changed after work started. Confirm the plan with your Host; your saved work is retained.</p>}
          {job.state === "scheduled" && <button className="back" onClick={() => {setGuideProperty(job.propertyId);setGuide(true);}}>Open Start Guide</button>}
          <button className="back" onClick={() => setIssueJobId(job.id)}>{job.state === "scheduled" ? "Report an issue" : "View reported issues"}</button>
          {job.state === "scheduled" && <button className="back" onClick={() => setCant(true)}>Can’t make this clean</button>}
          <button className="primary" disabled={busy || (job.state === "scheduled" && (!job.tasks.length || job.checked.length !== job.tasks.length))} onClick={() => setCompletionId(job.id)}>{job.state === "scheduled" ? "Complete clean" : "View completion"}</button>
        </div>}
      </section>
      </>}
      </main>
    </div>
    <Dialog showClose id="customerProperties" title="My customers" open={customers} onClose={closeCustomers}>{customers && <MyCustomers onDirty={setCustomerDirty} names={names} model={customerModel} initiallyAdding={addingCustomer} onCalendarsChanged={() => setCustomerCalendarVersion(v => v + 1)} />}</Dialog>
    <Dialog showClose id="mobileToolsDialog" title="Workspace tools" open={more} onClose={() => setMore(false)}><div ref={setTarget} /></Dialog>
    <Dialog showClose id="cantMakeDialog" title="Can’t make this clean?" open={cant} onClose={() => setCant(false)}>
      <p>Please let your host know as soon as possible so they can arrange another cleaner. This does not cancel the job.</p>
      <p>Your assignment remains in place. Arrange alternative cover with your Host using your existing arrangements.</p>

    </Dialog>
    <Dialog showClose id="jobIssuesDialog" title="Clean issues" open={!!issueJobId} onClose={closeIssues}>{issueJobId && <JobIssues onDirty={setIssueDirty} key={issueJobId} jobId={issueJobId} onChanged={() => void load()} />}</Dialog>
    <Dialog showClose id="completionDialog" title="Clean completion" open={!!completionId} onClose={() => setCompletionId("")}>{completionId && <Completion key={completionId} jobId={completionId} onChanged={() => void load()} />}</Dialog>
    <Dialog showClose id="startGuideDialog" title="Property Start Guide" open={guide} onClose={() => setGuide(false)}>{guide && <>
      <label className="field">Choose property<select value={guideProperty} onChange={e=>setGuideProperty(e.target.value)}><option value="">Choose a property</option>{properties.filter(p=>p.source==='assigned').map(p=><option key={p.id} value={p.id}>{names[p.id]||p.name}</option>)}</select></label>
      {properties.filter(p=>p.id===guideProperty&&p.source==='assigned').map(p=><StartGuide key={p.id} propertyId={p.id} assignmentId={p.assignmentId} jobId={p.assignmentId?undefined:p.jobId} />)}
      {!guideProperty&&<p>Choose an assigned property to read its private operational guidance.</p>}
      </>}</Dialog>
  </div>;
}
