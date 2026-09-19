"use client";
import { useCalendar } from "../calendar/useCalendar";
import CleaningCalendar from "../calendar/CleaningCalendar";
import { Icon } from "../dashboard/Sidebar";
export default function WorkspaceCalendar() {
  const calendar = useCalendar();
  return <>
    <p>Reservations are stays, separate from cleaning jobs. Scheduled checkout does not confirm physical checkout.</p>
    <div className="dialog-actions"><button className="back" onClick={() => void calendar.download()}><Icon name="add" /> Download Calendar</button><button className="back" onClick={() => void calendar.copy()}>{calendar.copied ? "Copied!" : "Copy iCal Link"}</button></div>
    <CleaningCalendar model={calendar} content={null} />
  </>;
}
