"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { request, message } from "../dashboard/api";
import "./completion.css";
import { categories } from "../../../lib/job-issues.cjs";
type Issue = { id: string; category: keyof typeof categories; description: string; createdAt: string; hasPhoto: boolean };
type Details = { id: string; revision: number; state: string; issues: Issue[] };
export default function JobIssues({ jobId, host = false, onChanged, onDirty }: { jobId: string; host?: boolean; onChanged: () => void; onDirty?: (dirty:boolean)=>void }) {
 const [data, setData] = useState<Details | null>(null), [status, setStatus] = useState("Loading issues…"), [busy, setBusy] = useState(false);
 const [category, setCategory] = useState("damage"), [description, setDescription] = useState(""), [photo, setPhoto] = useState<File | null>(null), [uploadKey, setUploadKey] = useState(0);
 useEffect(()=>{onDirty?.(!!description.trim()||!!photo);},[description,photo,onDirty]);
 const locked = useRef(false), sequence = useRef(0), issueId = useRef("");
 const load = useCallback(async () => {
  const seq = ++sequence.current;
  try { const next = await request<Details>("/api/job-issues?jobId=" + encodeURIComponent(jobId)); if (seq === sequence.current) { setData(next); setStatus(""); } }
  catch (e) { if (seq === sequence.current) { setData(null); setStatus(message(e)); } }
 }, [jobId]);
 useEffect(() => {
  void load(); const refresh = () => { if (locked.current) return; ++sequence.current; if (document.hidden) setData(null); else void load(); };
  window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); const timer = setInterval(refresh, 60000);
  return () => { ++sequence.current; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
 }, [load]);
 async function submit(e: FormEvent) {
  e.preventDefault(); if (!data || locked.current) return; locked.current = true; setBusy(true);
  try {
   if (photo && (photo.size > 3145728 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) throw Error("photo");
   issueId.current ||= crypto.randomUUID();
   const image = photo ? { type: photo.type, data: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(photo); }) } : undefined;
   await request("/api/job-issues", { id: issueId.current, jobId, revision: data.revision, category, description, ...(image ? { photo: image } : {}) });
   issueId.current = ""; setDescription(""); setPhoto(null); setUploadKey(v => v + 1); await load(); onChanged(); setStatus("Issue saved for your Host to review.");
  } catch (error) { await load(); setStatus(error instanceof Error && error.message === "photo" ? "Choose a JPEG, PNG or WebP photo up to 3 MiB." : message(error)); }
  finally { locked.current = false; setBusy(false); }
 }
 return <section className="completion job-issues" aria-busy={busy}>
  <p role="status">{status}</p>
  {data && <>
   {!host && data.state === "scheduled" && <form onSubmit={submit}>
    <label className="field">Issue category<select disabled={busy} value={category} onChange={e => { issueId.current = ""; setCategory(e.target.value); }}>{Object.entries(categories).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    <label className="field">Short description<textarea required maxLength={2000} rows={4} disabled={busy} value={description} onChange={e => { issueId.current = ""; setDescription(e.target.value); }} /></label>
    <p>Describe the problem. Keep access codes and personal contact details out of the report.</p>
    <label className="field">Optional issue photo<input key={uploadKey} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { issueId.current = ""; setPhoto(e.target.files?.[0] || null); }} /></label>
    <p>One photo, up to 3 MiB. Issue photos are separate from the 3–6 completion photos.</p>
    <button className="primary" disabled={busy || !description.trim()}>Save issue</button>
   </form>}
   <h3>Reported issues</h3>
   {!data.issues.length && <p>No issues reported for this clean.</p>}
   {data.issues.map(i => <article key={i.id}><h4>{categories[i.category]}</h4><p className="guide-text">{i.description}</p><time dateTime={i.createdAt}>{new Date(i.createdAt).toLocaleString("en-GB")}</time>{i.hasPhoto && <div className="completion-photos"><a href={"/api/job-issues?" + new URLSearchParams({ jobId, photoId: i.id })} target="_blank" rel="noopener noreferrer"><img src={"/api/job-issues?" + new URLSearchParams({ jobId, photoId: i.id })} alt="Reported issue" /></a></div>}</article>)}
  </>}
  {!data && !busy && <button className="back" onClick={() => void load()}>Try again</button>}
 </section>;
}
