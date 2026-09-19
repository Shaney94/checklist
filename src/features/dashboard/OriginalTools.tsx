"use client";
import { useEffect, useState } from "react";
import Dialog from "../../components/Dialog";
import type { PrivateContent, Kind } from "./types";
import type { WorkspaceModel } from "./useWorkspace";
import RichText from "./RichText";
import { issueTypes } from "./WorkspaceTools";
import { whatsapp } from "./api";
export default function OriginalTools({
  content,
  kind,
  model: m,
  onClose,
}: {
  content: PrivateContent;
  kind: Kind;
  model: WorkspaceModel;
  onClose: () => void;
}) {
  const [faqs, setFAQs] = useState<number[]>([]),
    [issue, setIssue] = useState(false),
    [category, setCategory] = useState("");
  useEffect(() => {
    if (kind !== "faqs") void m.load();
    document
      .querySelector<HTMLElement>("#faqView h1, #checklistView h1")
      ?.focus();
  }, [kind]);
  if (kind === "faqs")
    return (
      <main id="faqView">
        <div className="topbar">
          <button className="back" onClick={onClose}>
            ← Home
          </button>
          <div className="titleblock">
            <h1 tabIndex={-1}>Cleaner FAQ</h1>
            <p>
              Common questions about payment, supplies and cleaning operations
            </p>
          </div>
        </div>
        <div className="faq-list">
          {content.faqs.map((f, i) => (
            <div
              key={i}
              className={"faq-item" + (faqs.includes(i) ? " open" : "")}
            >
              <button
                className="faq-q"
                aria-controls={"faq-answer-" + i}
                aria-expanded={faqs.includes(i)}
                onClick={() =>
                  setFAQs((xs) =>
                    xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i],
                  )
                }
              >
                <span>{f.question}</span>
                <span>⌄</span>
              </button>
              <div id={"faq-answer-" + i} className="faq-a">
                <RichText nodes={f.answer} />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  const checked = m.state.data.legacyProgress?.[kind]?.checked || [],
    total = content[kind].reduce((sum, s) => sum + s[1].length, 0),
    done = checked.filter(Boolean).length,
    pct = total ? Math.round((done / total) * 100) : 0;
  let index = 0;
  function save(index: number, value: boolean) {
    const values = Array.from({ length: total }, (_, i) => !!checked[i]);
    values[index] = value;
    void m.save({
      action: "legacy-progress",
      kind,
      state: { checked: values },
    });
  }
  return (
    <main id="checklistView">
      <div className="topbar">
        <button className="back" onClick={onClose}>
          ← Home
        </button>
        <div className="titleblock">
          <h1 id="checklistTitle" tabIndex={-1}>
            {kind === "deep" ? "Deep Clean" : "Regular Clean"}
          </h1>
          <p>
            {kind === "deep"
              ? "Every 3 months: September · December · March · June"
              : "Complete after every guest checkout"}
          </p>
        </div>
      </div>
      <section className="progress-card">
        <div className="progress-row">
          <span>Overall progress</span>
          <div style={{ textAlign: "right" }}>
            <strong>
              {done} / {total}
            </strong>
            <div style={{ fontSize: 12, color: "#d1d5db" }}>
              {pct}% complete
            </div>
          </div>
        </div>
        <div className="bar">
          <div className="fill" style={{ width: pct + "%" }} />
        </div>
      </section>
      <div id="sections">
        {content[kind].map(([title, tasks], s) => {
          const start = index;
          index += tasks.length;
          return (
            <section className="section" key={s}>
              <div className="section-head">
                <h2>{title}</h2>
                <span className="section-count">
                  {tasks.filter((_, i) => checked[start + i]).length} /{" "}
                  {tasks.length}
                </span>
              </div>
              {tasks.map((text, i) => (
                <label
                  key={i}
                  className={"task" + (checked[start + i] ? " checked" : "")}
                >
                  <input
                    type="checkbox"
                    checked={!!checked[start + i]}
                    disabled={!m.ready || m.busy}
                    onChange={(e) => save(start + i, e.target.checked)}
                  />
                  <span>{text}</span>
                </label>
              ))}
            </section>
          );
        })}
      </div>
      <section className="report">
        <button
          className="primary"
          onClick={() => {
            setIssue(true);
            setCategory("");
          }}
        >
          Report an issue to host
        </button>
        <p style={{ marginTop: 10 }}>
          Choose an issue type, then review and send your message in WhatsApp.
          Attach photos there if helpful.
        </p>
      </section>
      <div className="actions">
        <span className="saved">
          {m.status || "Progress saved to your workspace."}
        </span>
        <button
          className="reset"
          disabled={m.busy || !m.ready}
          onClick={() => {
            if (confirm("Reset this entire checklist and all entered details?"))
              void m.save({
                action: "legacy-progress",
                kind,
                state: { checked: Array(total).fill(false) },
              });
          }}
        >
          Reset checklist
        </button>
      </div>
      <Dialog
        id="issueDialog"
        title="Report an issue to host"
        open={issue}
        onClose={() => setIssue(false)}
      >
        <p>
          {content.propertyName} ·{" "}
          {kind === "deep" ? "Deep Clean" : "Regular Clean"}
        </p>
        <fieldset className="issue-types">
          <legend>Choose an issue type</legend>
          {issueTypes.map((t) => (
            <label key={t}>
              <input
                type="radio"
                name="issueType"
                checked={category === t}
                onChange={() => setCategory(t)}
              />
              {t}
            </label>
          ))}
        </fieldset>
        <p>You can add details and photos in WhatsApp before pressing Send.</p>
        <div className="dialog-actions">
          {category && (
            <a
              className="primary"
              target="_blank"
              rel="noopener noreferrer"
              href={whatsapp(
                content.hostPhone,
                `Hi, I need to report an issue at ${content.propertyName} during the ${kind === "deep" ? "Deep Clean" : "Regular Clean"}. Issue type: ${category}.`,
              )}
            >
              Report via WhatsApp
            </a>
          )}
          <button className="back" onClick={() => setIssue(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </main>
  );
}
