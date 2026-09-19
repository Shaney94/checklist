"use client";
import {
  useEffect,
  useState,
  type ReactNode,
  type MouseEvent,
  type FocusEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Kind } from "./types";
import type { WorkspaceModel } from "./useWorkspace";
import type { CalendarModel } from "../calendar/useCalendar";
import { labels } from "./WorkspaceTools";
import { request } from "./api";
const paths = {
  calendar: "M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16",
  regular: "M9 6h12 M9 12h12 M9 18h12 M2 6l2 2 3-4 M2 12l2 2 3-4 M2 18l2 2 3-4",
  deep: "M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h6",
  faqs: "M12 17h.01 M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  copy: "M8 8h13v13H8z M16 8V3H3v13h5",
  add: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  collapse: "M14 6l-6 6 6 6",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={paths[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export default function Sidebar({
  model: m,
  calendar,
  hasOriginal,
  active,
  navigate,
  setup,
  mobile,
  toolsTarget,
}: {
  model: WorkspaceModel;
  calendar: CalendarModel;
  hasOriginal: boolean;
  active: Kind | "calendar";
  navigate: (v: Kind | "calendar") => void;
  setup: (edit: boolean) => void;
  mobile: boolean;
  toolsTarget: HTMLElement | null;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [tip, setTip] = useState<{
      label: string;
      top: number;
      left: number;
    } | null>(null);
  useEffect(() => {
    let alive = true;
    request<{ sidebarCollapsed: boolean }>("/api/dashboard?action=preferences")
      .then((p) => {
        if (alive) setCollapsed(p.sidebarCollapsed === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    return () => document.body.classList.remove("sidebar-collapsed");
  }, [collapsed]);
  useEffect(() => {
    const hide = () => setTip(null);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("resize", hide);
    document.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("resize", hide);
      document.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", key);
    };
  }, []);
  async function toggle() {
    setTip(null);
    const next = !collapsed;
    setCollapsed(next);
    setBusy(true);
    try {
      await request("/api/dashboard", {
        action: "preferences",
        sidebarCollapsed: next,
      });
      setStatus("");
    } catch {
      setCollapsed(!next);
      setStatus("Sidebar preference wasn’t saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function show(
    e: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    label: string,
  ) {
    if (!collapsed || mobile) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({
      label,
      left: Math.min(r.right + 10, innerWidth - 268),
      top: Math.max(8, Math.min(r.top, innerHeight - 44)),
    });
  }
  function button(
    name: keyof typeof paths,
    label: string,
    onClick: () => void,
    other: { disabled?: boolean; active?: boolean } = {},
  ) {
    return (
      <button
        key={name}
        type="button"
        className={"nav-item" + (other.active ? " active" : "")}
        aria-current={other.active ? "page" : undefined}
        aria-label={label}
        title={label}
        aria-describedby={tip?.label === label ? "sidebarTooltip" : undefined}
        disabled={other.disabled}
        onClick={onClick}
        onMouseEnter={(e) => show(e, label)}
        onFocus={(e) => show(e, label)}
        onMouseLeave={() => setTip(null)}
        onBlur={() => setTip(null)}
      >
        <Icon name={name} />
        <span className="nav-label">{label}</span>
      </button>
    );
  }
  const navigation = (
    <nav className="primary-navigation" aria-label="Main destinations">
      {button("calendar", "Calendar", () => navigate("calendar"), {
        active: active === "calendar",
      })}
      <p className="nav-group-label">Cleaning</p>
      {(["regular", "deep", "faqs"] as Kind[]).map((k) => (
        <span key={k} style={{ display: "contents" }}>
          {k === "faqs" && <p className="nav-group-label">Support</p>}
          {button(
            k,
            (m.property?.[k].length || hasOriginal ? "" : "＋ ") + labels[k],
            () => navigate(k),
            { disabled: !m.ready || m.busy, active: active === k },
          )}
        </span>
      ))}
    </nav>
  );
  const secondary: ReactNode = (
    <div className="sidebar-secondary">
      <p className="nav-group-label">Calendar tools</p>
      {button("add", "Download Calendar", () => void calendar.download())}
      {button(
        "copy",
        calendar.copied ? "Copied!" : "Copy iCal Link",
        () => void calendar.copy(),
      )}
      <p className="nav-group-label">Property setup</p>
      <div className="section workspace-property">
        <label className="field" htmlFor="workspaceProperty">
          Property
          <select
            id="workspaceProperty"
            value={m.selected}
            onChange={(e) => m.setSelected(e.target.value)}
          >
            <option value="">Choose a property</option>
            {m.state.data.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="dialog-actions">
          <button
            className="back"
            disabled={!m.ready || m.busy}
            onClick={() => setup(false)}
          >
            Add property
          </button>
          <button
            className="back"
            disabled={!m.property || m.busy}
            onClick={() => setup(true)}
          >
            Property setup
          </button>
        </div>
        <p id="propertySummary" className="calendar-help">
          {m.property
            ? m.property.notes ||
              "Your property’s cleaning tools are saved to this workspace."
            : "Add your property, then set up its checklists and FAQs."}
        </p>
      </div>
      <p id="workspaceStatus" role="status" aria-live="polite">
        {m.status}
      </p>
      {m.conflict && (
        <button className="back" onClick={() => void m.load()}>
          Reload workspace
        </button>
      )}
      <p className="sidebar-pref-status" role="status">
        {status}
      </p>
    </div>
  );
  return (
    <>
      <aside className="app-sidebar" aria-label="Workspace navigation">
        <button
          className="collapse-sidebar"
          disabled={busy}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => void toggle()}
        >
          <Icon name="collapse" />
        </button>
        {!mobile && (
          <>
            {navigation}
            {secondary}
          </>
        )}
      </aside>
      {mobile && createPortal(navigation, document.body)}
      {mobile && toolsTarget && createPortal(secondary, toolsTarget)}
      {tip &&
        createPortal(
          <div
            id="sidebarTooltip"
            role="tooltip"
            className="sidebar-tooltip"
            style={{ left: tip.left, top: tip.top }}
          >
            {tip.label}
          </div>,
          document.body,
        )}
    </>
  );
}
