"use client";
import { useCalendar } from "../calendar/useCalendar";
import CleaningCalendar from "../calendar/CleaningCalendar";
import { Icon } from "../dashboard/Sidebar";
export default function WorkspaceCalendar({ onAddCustomer }: { onAddCustomer?: () => void }) {
  const calendar = useCalendar();
  if (onAddCustomer && !calendar.calendars.length) return <section className="section job-workspace" aria-label="Calendar empty state">
    <h2>Your calendar</h2>
    {!calendar.loaded ? <><p role="status">{calendar.status || "Loading your calendars…"}</p>{!calendar.busy && <button className="back" onClick={() => void calendar.reload()}>Try again</button>}</> : <><p>Work assigned by a Turnli Host appears automatically. For customers you manage yourself, add a customer property and connect its calendar.</p><button className="primary" onClick={onAddCustomer}>Add customer property</button></>}
  </section>;
  const canExport = calendar.loaded && calendar.calendars.length > 0 && (!!calendar.selected || calendar.calendars.length === 1);
  return <>
    <p>Reservations are stays, separate from cleaning jobs. Scheduled checkout does not confirm physical checkout.</p>
    {canExport && <div className="dialog-actions"><button className="back" onClick={() => void calendar.download()}><Icon name="add" /> Download Calendar</button><button className="back" onClick={() => void calendar.copy()}>{calendar.copied ? "Copied!" : "Copy iCal Link"}</button></div>}
    <CleaningCalendar model={calendar} content={null} onAddCustomer={onAddCustomer} />
  </>;
}
