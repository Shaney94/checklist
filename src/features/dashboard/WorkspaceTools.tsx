"use client";
import { useEffect, useState, type FormEvent } from "react";
import Dialog from "../../components/Dialog";
import { whatsapp } from "./api";
import type { Kind, Property } from "./types";
import type { WorkspaceModel } from "./useWorkspace";
export const labels = {
  regular: "Regular Clean List",
  deep: "Deep Clean List",
  faqs: "FAQs",
};
export const issueTypes = [
  "Damage",
  "Missing item",
  "Maintenance issue",
  "Stock/supplies",
  "Cleaning issue",
  "Other",
];
export function PropertySetup({
  model: m,
  editing,
  onClose,
}: {
  model: WorkspaceModel;
  editing: Property | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name || ""),
    [phone, setPhone] = useState(editing?.phone || ""),
    [notes, setNotes] = useState(editing?.notes || "");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await m.save({
        action: "property",
        id: editing?.id || "",
        name,
        phone,
        notes,
      })
    )
      onClose();
  }
  return (
    <Dialog id="propertyDialog" title="Property setup" open onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          Property name
          <input
            autoFocus
            required
            maxLength={100}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          Host WhatsApp number
          <input
            type="tel"
            maxLength={30}
            placeholder="+44…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="field">
          Cleaning instructions
          <textarea
            rows={4}
            maxLength={3000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <p className="calendar-help">
          Connect booking feeds using Manage calendars. Use the same property
          name to keep things clear.
        </p>
        <p role="status">{m.status}</p>
        <div className="dialog-actions">
          <button className="primary" disabled={m.busy}>
            Save property
          </button>
          <button type="button" className="back" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export default function WorkspaceTools({
  model: m,
  kind,
  setupOnly = false,
  onClose,
}: {
  model: WorkspaceModel;
  kind: Kind;
  setupOnly?: boolean;
  onClose: () => void;
}) {
  const p = m.property!;
  const [editing, setEditing] = useState(!p[kind].length),
    [lines, setLines] = useState(kind === "faqs" ? "" : p[kind].join("\n")),
    [faqs, setFAQs] = useState(
      p.faqs.length ? p.faqs : [{ question: "", answer: "" }],
    ),
    [issue, setIssue] = useState(false),
    [category, setCategory] = useState("Damage");
  useEffect(() => {
    document.getElementById("workspaceContentTitle")?.focus();
  }, []);
  function edit() {
    setLines(kind === "faqs" ? "" : p[kind].join("\n"));
    setFAQs(p.faqs.length ? p.faqs : [{ question: "", answer: "" }]);
    setEditing(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await m.save({
        action: "content",
        id: p.id,
        kind,
        items:
          kind === "faqs"
            ? faqs
            : lines
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
      })
    )
      setEditing(false);
  }
  return (
    <section
      id="workspaceContentDialog"
      aria-labelledby="workspaceContentTitle"
    >
      <h2 id="workspaceContentTitle" tabIndex={-1}>
        {labels[kind]}
      </h2>
      <p className="calendar-help">{p.name}</p>
      {!editing ? (
        <>
          <div id="workspaceContentView">
            {kind === "faqs" ? (
              p.faqs.map((f, i) => (
                <details key={i}>
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))
            ) : (
              <>
                <p role="status">
                  {p.checked[kind].length} of {p[kind].length} completed
                </p>
                {p[kind].map((task, index) => (
                  <label key={index}>
                    <input
                      type="checkbox"
                      disabled={m.busy || setupOnly}
                      checked={p.checked[kind].includes(index)}
                      onChange={(e) =>
                        void m.save({
                          action: "check",
                          id: p.id,
                          kind,
                          index,
                          checked: e.target.checked,
                        })
                      }
                    />
                    <span>{task}</span>
                  </label>
                ))}
              </>
            )}
            {!p[kind].length && (
              <p>Nothing added yet. Choose Edit to set this up.</p>
            )}
          </div>
          <div className="dialog-actions">
            <button className="back" onClick={edit}>
              Edit
            </button>
            {kind !== "faqs" && !setupOnly && (
              <>
                <button
                  className="back"
                  disabled={m.busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Start a new clean? This clears completion ticks but keeps all checklist items.",
                      )
                    )
                      void m.save({ action: "reset", id: p.id, kind });
                  }}
                >
                  Start a new clean
                </button>
                {p.phone && (
                  <button className="back" onClick={() => setIssue(true)}>
                    Report an issue to host
                  </button>
                )}
              </>
            )}
            <button className="back" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : (
        <form id="workspaceContentForm" onSubmit={submit}>
          {kind === "faqs" ? (
            <>
              <div id="workspaceFAQFields">
                {faqs.map((f, i) => (
                  <div className="workspace-faq-row" key={i}>
                    <label className="field">
                      Question
                      <textarea
                        required
                        maxLength={300}
                        rows={2}
                        value={f.question}
                        onChange={(e) =>
                          setFAQs((fs) =>
                            fs.map((x, j) =>
                              i === j ? { ...x, question: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      Answer
                      <textarea
                        required
                        maxLength={3000}
                        rows={4}
                        value={f.answer}
                        onChange={(e) =>
                          setFAQs((fs) =>
                            fs.map((x, j) =>
                              i === j ? { ...x, answer: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="back"
                      onClick={() =>
                        setFAQs((fs) => fs.filter((_, j) => i !== j))
                      }
                    >
                      Remove question
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="back"
                onClick={() =>
                  setFAQs((fs) => [...fs, { question: "", answer: "" }])
                }
              >
                Add question
              </button>
            </>
          ) : (
            <>
              <label className="field">
                Checklist items — one per line
                <textarea
                  rows={10}
                  maxLength={100000}
                  value={lines}
                  onChange={(e) => setLines(e.target.value)}
                />
              </label>
              <p className="calendar-help">
                Saving checklist edits starts a fresh checklist for this
                property.
              </p>
            </>
          )}
          <div className="dialog-actions">
            <button className="primary" disabled={m.busy}>
              Save
            </button>
            <button type="button" className="back" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <p id="workspaceContentStatus" role="status">
        {m.status}
      </p>
      <Dialog
        id="workspaceIssueDialog"
        title="Report an issue to host"
        open={issue}
        onClose={() => setIssue(false)}
      >
        <label className="field">
          Issue type
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {issueTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <p>Review the message in WhatsApp and press Send yourself.</p>
        <a
          className="primary"
          target="_blank"
          rel="noopener noreferrer"
          href={whatsapp(
            p.phone,
            `Hi, I need to report ${category.toLowerCase()} at ${p.name} during the ${kind === "deep" ? "deep" : "regular"} clean on ${new Date().toLocaleDateString("en-GB")}. Details: `,
          )}
        >
          Report via WhatsApp
        </a>
        <div className="dialog-actions">
          <button className="back" onClick={() => setIssue(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </section>
  );
}
