"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { request, message, APIError } from "../dashboard/api";
import { guideFields, type Guide, type SavedGuide } from "./fields";
import "./start-guide.css";

export default function StartGuide({ propertyId, editable = false, onDirtyChange }: {
  propertyId: string;
  editable?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const fieldId = useId();
  const [saved, setSaved] = useState<SavedGuide | null>(null);
  const [draft, setDraft] = useState<Guide>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setSaved(null);
    setDraft({});
    setDirty(false);
    setStatus(propertyId ? "Loading Start Guide…" : "Choose a property to open its Start Guide.");
    if (propertyId) {
      setBusy(true);
      request<SavedGuide>("/api/start-guide?id=" + encodeURIComponent(propertyId), undefined, controller.signal)
        .then((data) => { setSaved(data); setDraft(data.guide); setStatus(""); })
        .catch((error) => { if (!controller.signal.aborted) setStatus(message(error)); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }
    return () => controller.abort();
  }, [propertyId, reload]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!saved || locked.current) return;
    locked.current = true;
    setBusy(true);
    setStatus("Saving Start Guide…");
    try {
      const guide = Object.fromEntries(Object.keys(guideFields).map((key) => [key, draft[key as keyof Guide] || ""]));
      const next = await request<SavedGuide>("/api/start-guide", { id: propertyId, revision: saved.revision, guide });
      setSaved(next);
      setDraft(next.guide);
      setDirty(false);
      setStatus("Start Guide saved.");
    } catch (error) {
      if (error instanceof APIError && (error.status === 401 || error.status === 403 || error.status === 404)) {
        setSaved(null); setDraft({}); setDirty(false);
      }
      setStatus(message(error));
    } finally { locked.current = false; setBusy(false); }
  }
  return (
    <section className="start-guide" aria-label="Property Start Guide" aria-busy={busy}>
      <p role="status">{status}</p>
      {saved && (editable ? (
        <form onSubmit={save} autoComplete="off">
          <p>Keep property access details here, separate from cleaning checklists. Cleaner access is not available yet.</p>
          {Object.entries(guideFields).map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={fieldId + key}>{label}</label>
              <textarea id={fieldId + key} rows={4} maxLength={5000} spellCheck={false} disabled={busy}
                value={draft[key as keyof Guide] || ""}
                onChange={(event) => { setDraft({ ...draft, [key]: event.target.value }); setDirty(true); }} />
            </div>
          ))}
          <button className="primary" disabled={busy || !dirty}>Save Start Guide</button>
        </form>
      ) : (
        <div>
          {Object.entries(guideFields).filter(([key]) => saved.guide[key as keyof Guide]).map(([key, label]) => (
            <section key={key}><h3>{label}</h3><p className="guide-text">{saved.guide[key as keyof Guide]}</p></section>
          ))}
          {!Object.values(saved.guide).some(Boolean) && <p>No instructions have been added yet.</p>}
        </div>
      ))}
      {propertyId && <button className="back guide-reload" disabled={busy} onClick={() => {
        if (!dirty || confirm("Discard unsaved changes and reload this Start Guide?")) setReload((value) => value + 1);
      }}>Reload guide</button>}
    </section>
  );
}
