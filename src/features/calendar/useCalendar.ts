"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Booking, Calendar } from "../dashboard/types";
import { request, message } from "../dashboard/api";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const date = (d: string) => new Date(d + "T12:00:00Z");
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const full = (d: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(date(d));
export function useCalendar(assignmentId?: string, allProperties = false) {
  const [month, setMonth] = useState(() => today().slice(0, 7) + "-01"),
    [selected, setSelected] = useState(""),
    [calendars, setCalendars] = useState<Calendar[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [status, setStatus] = useState(""),
    [connected, setConnected] = useState(true),
    [hasCalendar, setHasCalendar] = useState(false),
    [zone, setZone] = useState("Europe/London"),
    [newIDs, setNewIDs] = useState<string[]>([]),
    [copied, setCopied] = useState(false);
  const explicitAll = useRef(false),
    sequence = useRef(0),
    subscriptionURL = useRef(""),
    newTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    loadedRef = useRef(false),
    syncing = useRef(false);
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    setBusy(true);
    setStatus("Loading your booking calendar…");
    try {
      const q = new URLSearchParams({ month: month.slice(0, 7) });
      if (selected) q.set("id", selected);
      if (assignmentId) { q.set("action", "calendar"); q.set("id", assignmentId); }
      const data = await request<{
        calendars: Calendar[];
        bookings: Booking[];
        state?: string;
        timeZone?: string;
        hasCalendar?: boolean; syncError?: boolean;
      }>((assignmentId ? "/api/property-assignments?" : "/api/calendar?") + q);
      if (seq !== sequence.current) return;
      setCalendars(data.calendars || []);
      setHasCalendar(assignmentId ? data.hasCalendar === true : !!data.calendars?.length);
      setZone(data.timeZone || "Europe/London");
      if (!allProperties && data.calendars.length > 10 && !selected && !explicitAll.current) {
        setSelected(data.calendars[0].id);
        return;
      }
      setConnected(data.state !== "not-connected");
      if (data.state === "not-connected") {
        setBookings([]);
        setStatus(
          "Connect your booking calendar to see upcoming stays and plan cleaning jobs separately.",
        );
        setLoaded(true);
        loadedRef.current = true;
        return;
      }
      if (!Array.isArray(data.bookings))
        throw Error("Invalid calendar response");
      setBookings(data.bookings);
      setLoaded(true);
      loadedRef.current = true;
      setStatus(
        data.calendars.some((c) => c.error && (!selected || c.id === selected))
          ? "Some calendars could not sync. Previously saved bookings are shown; check Manage calendars."
          : data.bookings.length
            ? ""
            : "No stays this month.",
      );
      if (assignmentId) { setNewIDs([]); setStatus(data.syncError ? "The Host’s calendar could not sync. Previously saved reservations are shown." : !data.hasCalendar ? "Your Host has not linked a calendar to this property yet." : data.bookings.length ? "" : "No stays this month."); return; }
      const ids = data.bookings.filter((b) => b.isNew).map((b) => b.id);
      setNewIDs([]);
      if (newTimer.current) clearTimeout(newTimer.current);
      try {
        for (let i = 0; i < ids.length; i += 50)
          await request("/api/calendar", {
            action: "seen",
            ids: ids.slice(i, i + 50),
          });
        if (seq === sequence.current) {
          setNewIDs(ids);
          newTimer.current = setTimeout(() => {
            setNewIDs([]);
            setBookings((bs) => bs.map((b) => ({ ...b, isNew: false })));
          }, 6200);
        }
      } catch {
        if (seq === sequence.current)
          setStatus(
            (s) =>
              s +
              " New-booking markers could not be saved; they will be retried when the calendar reloads.",
          );
      }
    } catch (e) {
      if (assignmentId && seq === sequence.current) { setBookings([]); setCalendars([]); setConnected(false); }
      if (seq === sequence.current)
        setStatus(
          message(e) +
            (loadedRef.current
              ? " Previously loaded bookings may be out of date."
              : ""),
        );
    } finally {
      if (seq === sequence.current) setBusy(false);
    }
  }, [month, selected, assignmentId, allProperties]);
  useEffect(() => {
    void load();
    const visible = () => {
      if (assignmentId) { setBookings([]); setConnected(false); }
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    if (assignmentId) window.addEventListener("focus", visible);
    const timer = assignmentId ? setInterval(visible, 60000) : null;
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", visible);
      sequence.current++;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load, assignmentId]);
  useEffect(
    () => () => {
      if (newTimer.current) clearTimeout(newTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  async function reload(removed?: string) {
    subscriptionURL.current = "";
    if (removed === selected) {
      setSelected("");
      return;
    }
    await load();
  }
  async function refresh(id?: string) {
    if (syncing.current) return "";
    syncing.current = true;
    setBusy(true);
    setStatus("Syncing calendars…");
    try {
      let offset: number | null = 0;
      const results: { ok?: boolean; skipped?: boolean }[] = [];
      do {
        const data: { results: typeof results; nextOffset: number | null } =
          await request(
            "/api/calendar",
            { action: "refresh", id, offset },
            AbortSignal.timeout(240000),
          );
        results.push(...data.results);
        offset = data.nextOffset;
      } while (offset !== null);
      const text = results.some((r) => r.ok === false)
        ? "Some calendars could not sync. Previously saved bookings are preserved."
        : results.length && results.every((r) => r.skipped)
          ? "Calendars were refreshed recently or are paused. Please wait five minutes before syncing again."
          : "Calendars refreshed.";
      await reload();
      setStatus(text);
      return text;
    } catch (e) {
      setStatus(message(e));
      throw e;
    } finally {
      syncing.current = false;
      setBusy(false);
    }
  }
  async function subscription() {
    if (subscriptionURL.current) return subscriptionURL.current;
    const data = await request<{ url: string }>(
      "/api/calendar?" +
        new URLSearchParams({
          action: "subscription",
          ...(selected ? { id: selected } : {}),
        }),
    );
    if (!data.url) throw Error("Calendar subscription is unavailable.");
    subscriptionURL.current = data.url;
    return data.url;
  }
  async function download() {
    try {
      location.assign(await subscription());
    } catch (e) {
      setStatus(message(e));
    }
  }
  async function copy() {
    if (calendars.length > 1 && !selected) {
      setStatus("Choose a property before copying its calendar link.");
      return;
    }
    try {
      if (typeof ClipboardItem === "function" && navigator.clipboard?.write)
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": subscription().then(
              (url) => new Blob([url], { type: "text/plain" }),
            ),
          }),
        ]);
      else await navigator.clipboard.writeText(await subscription());
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setStatus(message(e));
    }
  }
  return {
    setMonth,
    month,
    selected,
    calendars,
    bookings,
    busy,
    loaded,
    status,
    connected,
    hasCalendar,
    zone,
    newIDs,
    copied,
    reload,
    refresh,
    download,
    copy,
    filter(id: string) {
      explicitAll.current = !id;
      subscriptionURL.current = "";
      setSelected(id);
    },
    move(delta: number) {
      if (!busy) {
        const d = date(month);
        d.setUTCMonth(d.getUTCMonth() + delta);
        setMonth(iso(d));
      }
    },
    goToday() {
      if (!busy) {
        const value = today().slice(0, 7) + "-01";
        if (value === month) void load();
        else setMonth(value);
      }
    },
  };
}
export type CalendarModel = ReturnType<typeof useCalendar>;
