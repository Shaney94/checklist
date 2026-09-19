"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request, message } from "../dashboard/api";
import { stateLabels, type JobState } from "./types";
import "./completion.css";
type Evidence = {
  id: string; propertyName: string; state: JobState; revision: number;
  tasks: string[]; checked: number[]; submittedAt: string | null; reviewedAt: string | null; reviewNote: string | null;
  photos: { id: string; width: number; height: number; size: number }[];
  requirements: { minPhotos: number; maxPhotos: number; maxUploadBytes: number };
};
const photoURL = (jobId: string, photoId: string) => "/api/completion?" + new URLSearchParams({ jobId, photoId });
function encode(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error("This photo could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
}
export default function Completion({ jobId, host = false, onChanged }: { jobId: string; host?: boolean; onChanged: () => void }) {
  const [data, setData] = useState<Evidence | null>(null), [status, setStatus] = useState("Loading completion…"), [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false), [note, setNote] = useState("");
  const locked = useRef(false), alive = useRef(true), sequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const next = await request<Evidence>("/api/completion?jobId=" + encodeURIComponent(jobId));
      if (alive.current && seq === sequence.current) { setData(next); setStatus(""); }
      return next;
    } catch (e) {
      if (alive.current && seq === sequence.current) { setData(null); setReview(false); setStatus(message(e)); }
      throw e;
    }
  }, [jobId]);
  useEffect(() => {
    alive.current = true; void load().catch(() => {});
    const refresh = () => {
      if (locked.current) return;
      if (document.hidden) setData(null); setReview(false);
      if (!document.hidden) void load().catch(() => {});
    };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60000);
    return () => { alive.current = false; ++sequence.current; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  async function action(body: object, finished = false) {
    if (!data || locked.current) return;
    locked.current = true; setBusy(true); setStatus("Saving…");
    try {
      await request("/api/completion", { ...body, jobId, revision: data.revision });
      await load(); if (finished) onChanged();
    } catch (e) {
      // Refetch after a rejected or interrupted write, including lost assignment.
      await load().catch(() => {});
      if (alive.current) setStatus(message(e));
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function upload(files: File[]) {
    if (!data || !files?.length || locked.current) return;
    if (data.photos.length + files.length > data.requirements.maxPhotos) { setStatus("Choose no more than 6 photos in total."); return; }
    if (Array.from(files).some(f => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > data.requirements.maxUploadBytes)) { setStatus("Choose JPEG, PNG or WebP photos, each up to 3 MiB."); return; }
    locked.current = true; setBusy(true); setReview(false);
    let revision = data.revision;
    try {
      for (let index = 0; index < files.length; index++) {
        if (!alive.current) break;
        setStatus(`Uploading photo ${index + 1} of ${files.length}…`);
        const file = files[index];
        const result = await request<{ revision: number }>("/api/completion", { action: "upload", jobId, revision, type: file.type, data: await encode(file) });
        revision = result.revision;
      }
      if (alive.current) await load();
    } catch (e) { await load().catch(() => {}); if (alive.current) setStatus(message(e)); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  const draft = data?.state === "scheduled" && !host;
  const ready = !!data && data.tasks.length > 0 && data.checked.length === data.tasks.length && data.tasks.every((_, i) => data.checked.includes(i)) && data.photos.length >= data.requirements.minPhotos && data.photos.length <= data.requirements.maxPhotos;
  return <section className="completion" aria-busy={busy}>
    <p role="status">{status}</p>
    {data && <>
      <h3>{data.propertyName}</h3><p>{stateLabels[data.state]}</p>
      {data.submittedAt && <p>Submitted: <time dateTime={data.submittedAt}>{new Date(data.submittedAt).toLocaleString("en-GB")}</time></p>}
      {data.reviewNote && <p className="guide-text"><strong>Host issue: </strong>{data.reviewNote}</p>}
      <h3>Checklist</h3>
      <ul>{data.tasks.map((task, i) => <li key={i}>{data.checked.includes(i) ? "✓ " : "Not checked: "}{task}</li>)}</ul>
      {!data.tasks.length && <p>No checklist was configured for this job. Ask the Host to replace it with a job containing the correct tasks.</p>}
      <h3>Completion photos ({data.photos.length}/{data.requirements.maxPhotos})</h3>
      <div className="completion-photos">{data.photos.map((photo, i) => <figure key={photo.id}>
        <a href={photoURL(jobId, photo.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open completion photo ${i + 1}`}><img src={photoURL(jobId, photo.id)} alt={`Completion photo ${i + 1}`} width={photo.width} height={photo.height} /></a>
        <figcaption>Photo {i + 1}{draft && !review && <button className="back" disabled={busy} onClick={() => void action({ action: "remove", photoId: photo.id })}>Remove photo {i + 1}</button>}</figcaption>
      </figure>)}</div>
      {draft ? <>
        {!review && <>
          <label className="field">Upload completion photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || data.photos.length >= data.requirements.maxPhotos} onChange={e => { void upload(Array.from(e.target.files || [])); e.target.value = ""; }} /></label>
          <p>Required: 3–6 different photos. JPEG, PNG or WebP, up to 3 MiB and 16 megapixels each. Photos are stored privately.</p>
          <button className="primary" disabled={busy || !ready} onClick={() => setReview(true)}>Review checklist and evidence</button>
        </>}
        {review && <><p>Review the checklist and photos above. Submitting records this clean as completed and awaiting Host review. Your checklist and evidence will then be locked.</p><button className="primary" disabled={busy || !ready} onClick={() => void action({ action: "submit" }, true)}>Submit completion</button> <button className="back" disabled={busy} onClick={() => setReview(false)}>Back to photos</button></>}
      </> : <p>The submitted checklist and photos are locked. Issue follow-up does not overwrite this evidence.</p>}
      {host && data.state === "awaiting_review" && <div>
        <button className="primary" disabled={busy} onClick={() => void action({ action: "approve" }, true)}>Approve clean</button>
        <label className="field">Issue details<textarea maxLength={2000} rows={3} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></label>
        <button className="back" disabled={busy || !note.trim()} onClick={() => void action({ action: "issue", note }, true)}>Report issue</button>
      </div>}
    </>}
    <button className="back" disabled={busy} onClick={() => { setReview(false); void load().catch(() => {}); }}>Reload completion</button>
  </section>;
}
