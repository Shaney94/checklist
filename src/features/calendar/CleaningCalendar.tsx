"use client";
import { useEffect, useState } from "react";
import Dialog from "../../components/Dialog";
import type { Booking, PrivateContent } from "../dashboard/types";
import { whatsapp } from "../dashboard/api";
import { segments, timezoneLabel } from "./layout";
import { date, iso, today, full, type CalendarModel } from "./useCalendar";
import CalendarManagement from "./CalendarManagement";
export default function CleaningCalendar({
  model: m,
  content,
  readOnly = false,
  onAddCustomer,
}: {
  model: CalendarModel;
  content: PrivateContent | null;
  readOnly?: boolean;
  onAddCustomer?: () => void;
}) {
  const [manage, setManage] = useState(false),
    [search, setSearch] = useState(""),
    [booking, setBooking] = useState<Booking | null>(null),
    [cant, setCant] = useState(false);
  useEffect(() => { if (readOnly) { setBooking(null); setCant(false); } }, [m.bookings, readOnly]);
  const d = date(m.month),
    offset = (d.getUTCDay() + 6) % 7,
    start = +d - offset * 86400000,
    weeks = Math.ceil(
      (offset +
        new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12),
        ).getUTCDate()) /
        7,
    );
  const time = (b: Booking["arrival"]) => b.time || "Time not provided";
  const label = (b: Booking) =>
    `${b.property} · ${b.source || "Reservation"} · Check-in ${full(b.arrival.date)} ${time(b.arrival)} · Check-out ${full(b.checkout.date)} ${time(b.checkout)}${b.guests ? " · " + b.guests + " guests" : ""}`;
  const monthEnd = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
  const zone = timezoneLabel(m.month, monthEnd, m.zone);
  return (
    <>
      <section
        id="cleaningCalendar"
        className="section calendar-embed"
        tabIndex={-1}
        aria-label="Cleaning calendar"
      >
        <div className="native-calendar-heading">
          <h2>Turnli Cleaning Calendar</h2>
          {!readOnly && <div className="calendar-heading-actions">
            <button
              className="back"
              id="manageCalendars"
              onClick={() => setManage(true)}
            >
              {m.calendars.length ? "Manage calendars" : "＋ Add Calendar"}
            </button>
            <button
              className="back"
              id="refreshCalendar"
              disabled={m.busy}
              onClick={() =>
                void m.refresh(m.selected || undefined).catch(() => {})
              }
            >
              Refresh calendars
            </button>
          </div>}
        </div>
        {m.calendars.length > 1 && (
          <div className="calendar-filter" id="calendarFilter">
            <label htmlFor="propertySearch">Find a property</label>
            <input
              type="search"
              id="propertySearch"
              placeholder="Search properties"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label htmlFor="propertyFilter" className="sr-only">
              Calendar property
            </label>
            <select
              id="propertyFilter"
              value={m.selected}
              onChange={(e) => m.filter(e.target.value)}
            >
              <option value="">All properties</option>
              {m.calendars
                .filter(
                  (c) =>
                    c.id === m.selected ||
                    c.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <p id="calendarStatus" className="calendar-status" role="status">
          {m.status}
        </p>
        {!m.loaded && m.busy && (
          <div
            id="calendarSkeleton"
            className="calendar-skeleton"
            role="status"
            aria-label="Loading calendar"
          >
            <div />
            <div />
            <div />
          </div>
        )}
        {m.loaded && m.connected && (
          <div id="nativeCalendar" aria-busy={m.busy}>
            <div className="month-toolbar">
              <button
                className="back"
                aria-label="Previous month"
                disabled={m.busy}
                onClick={() => m.move(-1)}
              >
                ←
              </button>
              <h3 id="calendarMonth" aria-live="polite">
                {new Intl.DateTimeFormat("en-GB", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(d)}
              </h3>
              <button
                className="back"
                aria-label="Next month"
                disabled={m.busy}
                onClick={() => m.move(1)}
              >
                →
              </button>
              <button className="back" disabled={m.busy} onClick={m.goToday}>
                Today
              </button>
              <span className="calendar-zone" title={m.zone}>
                {zone}
              </span>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div
              id="calendarDays"
              className="calendar-days"
              aria-label="Dates in this month"
            >
              <div className="desktop-month">
                {Array.from({ length: weeks }, (_, w) => {
                  const ws = new Date(start + w * 7 * 86400000);
                  return (
                    <div className="booking-week" key={w}>
                      <div className="week-dates">
                        {Array.from({ length: 7 }, (_, i) => {
                          const day = new Date(+ws + i * 86400000),
                            now = iso(day) === today();
                          return (
                            <span
                              key={i}
                              className={
                                (day.getUTCMonth() !== d.getUTCMonth()
                                  ? "outside-month "
                                  : "") + (now ? "is-today" : "")
                              }
                              aria-label={full(iso(day))}
                              aria-current={now ? "date" : undefined}
                            >
                              {day.getUTCDate()}
                            </span>
                          );
                        })}
                      </div>
                      <div className="week-stays">
                        {segments(m.bookings, iso(ws)).map((s) => {
                          const b = s.booking;
                          return (
                            <div
                              key={b.id}
                              className="stay-container"
                              style={{
                                gridColumn: `${s.first + 1} / ${s.last + 1}`,
                                gridRow: s.lane + 1,
                              }}
                            >
                              <button
                                type="button"
                                className={
                                  "stay-bar" +
                                  (s.continuesBefore
                                    ? " continues-before"
                                    : "") +
                                  (s.continuesAfter ? " continues-after" : "") +
                                  (m.newIDs.includes(b.id)
                                    ? " booking-new"
                                    : "")
                                }
                                data-booking-id={b.id}
                                data-source={b.sourceKey || "unknown"}
                                data-new-booking={b.isNew ? "true" : undefined}
                                title={label(b)}
                                aria-label={
                                  label(b) + (b.isNew ? " · New booking" : "")
                                }
                                onClick={() => {
                                  setBooking(b);
                                  setCant(false);
                                }}
                              >
                                <span className="stay-normal">
                                  {!s.continuesBefore && (
                                    <span className="stay-start">
                                      {b.arrival.time || "—"}
                                      <span className="time-caption"> Check-in</span>
                                    </span>
                                  )}
                                  <span className="stay-summary">
                                    <span className="stay-property">{b.property}</span>
                                    {b.source && <span className="stay-source">{b.source}</span>}
                                    {!!b.guests && (
                                      <span className="stay-guests">
                                        {b.guests}<span className="guest-word"> {b.guests === 1 ? "guest" : "guests"}</span>
                                      </span>
                                    )}
                                    {!b.guests && <span className="stay-fallback">Stay</span>}
                                  </span>
                                  {!s.continuesAfter && (
                                    <span className="stay-end">
                                      {b.checkout.time || "—"}
                                      <span className="time-caption"> Checkout</span>
                                    </span>
                                  )}
                                  {s.continuesAfter && <span className="continuation-arrow" aria-hidden="true">↳</span>}
                                </span>
                                <span className="new-booking-label">
                                  New booking
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {content?.originalCalendar && (
          <details id="originalCalendar">
            <summary>Original booking calendar</summary>
            <iframe
              src={content.originalCalendar}
              title="Cleaning Calendar"
              loading="lazy"
            />
          </details>
        )}
      </section>
      {manage && !readOnly && (
        <CalendarManagement
          calendars={m.calendars}
          open={manage}
          onClose={() => setManage(false)}
          onAddCustomer={onAddCustomer}
          reload={m.reload}
          refresh={m.refresh}
        />
      )}
      <Dialog
        id="cleanDialog"
        title="Reservation details"
        open={!!booking}
        onClose={() => setBooking(null)}
      >
        {booking && (
          <>
            <div id="cleanDetailsText">
              <div>
                <strong>Property: </strong>
                {booking.property}
              </div>
              <div>
                <strong>Check-in: </strong>
                {full(booking.arrival.date)} · {time(booking.arrival)}
              </div>
              <div>
                <strong>Checkout: </strong>
                {full(booking.checkout.date)} · {time(booking.checkout)}
              </div>
              {!!booking.guests && (
                <div>
                  <strong>Guests: </strong>
                  {booking.guests}
                </div>
              )}
              {booking.source && (
                <div>
                  <strong>Booking source: </strong>
                  {booking.source}
                </div>
              )}
            </div>
            <p>
              <span title="Timezone">{m.zone}</span>
              {booking.arrival.timeSource === "property-rule" ||
              booking.checkout.timeSource === "property-rule"
                ? " · Property default times · Date-only feed"
                : ""}
            </p>
            {booking.canContactHost &&
              content?.hostPhone &&
              (!cant ? (
                <button
                  className="primary"
                  onClick={() => {
                    setCant(true);
                    setTimeout(
                      () => document.getElementById("cantMakeTitle")?.focus(),
                      0,
                    );
                  }}
                >
                  Can’t make this clean
                </button>
              ) : (
                <div>
                  <h3 id="cantMakeTitle" tabIndex={-1}>
                    Can’t make this clean?
                  </h3>
                  <p>
                    Please let your host know as soon as possible so they can
                    arrange another cleaner.
                  </p>
                  <a
                    className="primary"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={whatsapp(
                      content.hostPhone,
                      `Hi, I’m unable to make the clean at ${booking.property} after checkout on ${full(booking.checkout.date)}${booking.checkout.time ? " at " + booking.checkout.time + " (UK time)" : ""}. I wanted to let you know as soon as possible so alternative cover can be arranged.`,
                    )}
                  >
                    Contact host on WhatsApp
                  </a>
                  <p>Review the message and press Send in WhatsApp.</p>
                </div>
              ))}
          </>
        )}
        <div className="dialog-actions">
          <button className="back" onClick={() => setBooking(null)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </>
  );
}
