"use client";
import { useState, type FormEvent } from "react";
import Dialog from "../../components/Dialog";
import type { Calendar } from "../dashboard/types";
import { request, message } from "../dashboard/api";
export const syncDate = (s?: string) =>
  s
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(s))
    : "Not yet synced";
export default function CalendarManagement({
  calendars,
  open,
  onClose,
  reload,
  refresh,
}: {
  calendars: Calendar[];
  open: boolean;
  onClose: () => void;
  reload: (removed?: string) => Promise<void>;
  refresh: (id?: string) => Promise<string>;
}) {
  const [editing, setEditing] = useState<Calendar | null | undefined>(
      calendars.length ? undefined : null,
    ),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(""),
    [url, setURL] = useState(""),
    [platform, setPlatform] = useState("Custom iCal"),
    [checkIn, setCheckIn] = useState("15:00"),
    [checkOut, setCheckOut] = useState("10:00"),
    [enabled, setEnabled] = useState(true);
  function edit(c: Calendar | null) {
    setEditing(c);
    setName(c?.name || "");
    setURL("");
    setPlatform(c?.platform || "Custom iCal");
    setCheckIn(c?.checkIn || "15:00");
    setCheckOut(c?.checkOut || "10:00");
    setEnabled(c?.enabled !== false);
    setTimeout(() => document.getElementById("calendarName")?.focus(), 0);
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setStatus(message(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await request(
        "/api/calendar",
        {
          action: editing ? "update" : "connect",
          id: editing?.id,
          name,
          platform,
          checkIn,
          checkOut,
          enabled,
          ...(!editing ? { url: url.trim() } : {}),
        },
        AbortSignal.timeout(240000),
      );
      setStatus(editing ? "Calendar updated." : "Calendar connected ✓");
      setEditing(undefined);
      await reload();
    });
  }
  return (
    <Dialog
      id="calendarsDialog"
      title="Manage calendars"
      open={open}
      onClose={onClose}
    >
      <p className="calendar-help">
        Feeds sync daily in the background. You can also refresh them here; each
        feed has a five-minute refresh cooldown.
      </p>
      <div id="connectedCalendars">
        {!calendars.length ? (
          <p>No calendars connected yet.</p>
        ) : (
          calendars.map((c) => (
            <section className="connected-calendar" key={c.id}>
              <h3>{c.name}</h3>
              <p>
                {c.platform} · {c.status}
                {c.status === "Connected" ? " ✓" : ""}
              </p>
              <p className="calendar-help">
                Last synced: {syncDate(c.lastSuccess)}
              </p>
              {c.error && <p className="calendar-error">{c.error}</p>}
              <div className="calendar-row-actions">
                <button
                  disabled={busy}
                  className="back"
                  onClick={() => edit(c)}
                >
                  View details / Rename
                </button>
                <button
                  disabled={busy}
                  className="back"
                  onClick={() =>
                    void run(async () => setStatus(await refresh(c.id)))
                  }
                >
                  Refresh/sync
                </button>
                <button
                  disabled={busy}
                  className="back"
                  onClick={() => {
                    if (
                      confirm(
                        "Remove " +
                          c.name +
                          " from Turnli? This does not cancel bookings at the source.",
                      )
                    )
                      void run(async () => {
                        await request("/api/calendar", {
                          action: "remove",
                          id: c.id,
                        });
                        setEditing(undefined);
                        await reload(c.id);
                        setStatus("Calendar removed.");
                      });
                  }}
                >
                  Remove calendar
                </button>
              </div>
            </section>
          ))
        )}
      </div>
      <button
        className="primary"
        id="addCalendar"
        disabled={busy}
        onClick={() => edit(null)}
      >
        + Add calendar
      </button>
      {editing !== undefined && (
        <form id="calendarForm" onSubmit={submit}>
          <h3>{editing ? "Calendar details" : "Add calendar"}</h3>
          {editing && (
            <p className="calendar-help">
              Feed host: {editing.host || editing.platform}. Last sync attempt:{" "}
              {syncDate(editing.lastAttempt)}.
            </p>
          )}
          <label className="field">
            Calendar/property name
            <input
              id="calendarName"
              required
              maxLength={100}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {!editing && (
            <label className="field">
              iCal URL
              <input
                id="calendarURL"
                type="url"
                required
                placeholder="https://…"
                autoComplete="off"
                spellCheck={false}
                maxLength={4096}
                value={url}
                onChange={(e) => setURL(e.target.value)}
              />
            </label>
          )}
          <label className="field">
            Platform/source
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {[
                "Custom iCal",
                "Airbnb",
                "Booking.com",
                "Vrbo",
                "Houfy",
                "TurnCal",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="calendar-times">
            <label className="field">
              Check-in time
              <input
                type="time"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </label>
            <label className="field">
              Checkout time
              <input
                type="time"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </label>
          </div>
          <p className="calendar-help">
            UK property times apply when the feed supplies dates without times.
          </p>
          {editing && (
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />{" "}
              Calendar enabled
            </label>
          )}
          <div className="dialog-actions">
            <button className="primary" disabled={busy}>
              {editing ? "Save changes" : "Connect calendar"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="back"
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <p id="calendarManagementStatus" role="status" aria-live="polite">
        {status}
      </p>
      <div className="dialog-actions">
        <button className="back" disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
