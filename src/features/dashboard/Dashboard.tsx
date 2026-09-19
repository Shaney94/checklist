"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Dialog from "../../components/Dialog";
import { request, message } from "./api";
import type { User, PrivateContent, Kind, Property } from "./types";
import { useWorkspace } from "./useWorkspace";
import { useCalendar } from "../calendar/useCalendar";
import CleaningCalendar from "../calendar/CleaningCalendar";
import WorkspaceTools, { PropertySetup } from "./WorkspaceTools";
import OriginalTools from "./OriginalTools";
import Sidebar, { Icon } from "./Sidebar";
import Account from "./Account";
import Reminder from "./Reminder";
import HostWorkspace from "../host/HostWorkspace";
import { can } from "../../../lib/authorization.cjs";
type Bootstrap = { user: User; content: PrivateContent | null };
export default function Dashboard({ hostSection = "properties" }: { hostSection?: string }) {
  const [data, setData] = useState<Bootstrap | null>(null),
    [error, setError] = useState("");
  const current = useRef(data);
  current.current = data;
  useEffect(() => {
    const controller = new AbortController();
    request<Bootstrap>("/api/dashboard-bootstrap", undefined, controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    document.body.classList.add("workspace-shell");
    let checking = false,
      active = true;
    const verify = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await request<{ user: User | null }>("/api/account");
        if (!result.user) throw Error("No session");
        if (
          current.current &&
          (result.user.id !== current.current.user.id ||
            result.user.workspaceId !== current.current.user.workspaceId ||
            result.user.legacyAccess !== current.current.user.legacyAccess ||
            result.user.role !== current.current.user.role)
        ) {
          document.body.classList.add("session-checking");
          location.reload();
          return;
        }
        if (active) document.body.classList.remove("session-checking");
      } catch {
        document.body.classList.add("session-checking");
        location.replace(
          "/?next=" + encodeURIComponent(location.pathname + location.hash),
        );
      } finally {
        checking = false;
      }
    };
    const hide = () => document.body.classList.add("session-checking"),
      visible = () => {
        if (!document.hidden) void verify();
      },
      storage = (e: StorageEvent) => {
        if (e.key === "turnli-signout") location.replace("/");
      };
    window.addEventListener("pageshow", verify);
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("storage", storage);
    const timer = setInterval(verify, 60000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("pageshow", verify);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("storage", storage);
      document.body.classList.remove("workspace-shell", "session-checking");
    };
  }, []);
  return data ? (
    can(data.user, "host.view") ? <HostWorkspace user={data.user} section={hostSection} /> :
    can(data.user, "cleaner.view") ? <Workbench data={data} /> :
    <div className="wrap"><p role="alert">Workspace role unavailable or unsupported.</p><Account user={data.user} /></div>
  ) : (
    <div className="wrap">
      <p role="status">{error || "Loading your workspace…"}</p>
      {error && (
        <button className="back" onClick={() => location.reload()}>
          Try again
        </button>
      )}
    </div>
  );
}
function Workbench({ data }: { data: Bootstrap }) {
  const m = useWorkspace(),
    calendar = useCalendar();
  const [hash, setHash] = useState(""),
    [mobile, setMobile] = useState(false),
    [more, setMore] = useState(false),
    [target, setTarget] = useState<HTMLDivElement | null>(null),
    [setup, setSetup] = useState<Property | null | undefined>(undefined),
    [version, setVersion] = useState(0);
  useEffect(() => {
    setHash(location.hash);
    const media = matchMedia("(max-width:700px)"),
      resize = () => {
        setMobile(media.matches);
        setMore(false);
      };
    resize();
    media.addEventListener("change", resize);
    const pop = () => {
      setHash(location.hash);
      setMore(false);
      setSetup(undefined);
      setVersion((v) => v + 1);
    };
    window.addEventListener("popstate", pop);
    return () => {
      media.removeEventListener("change", resize);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  const k = hash.replace(/^#(?:tools-)?/, "");
  const kind: Kind | "calendar" =
    k === "regular" || k === "deep"
      ? k
      : k === "faq" || k === "faqs"
        ? "faqs"
        : "calendar";
  const original = !hash.startsWith("#tools-") && !!data.content;
  function navigate(k: Kind | "calendar") {
    if (k !== "calendar" && !m.property && !data.content) {
      m.setStatus("Add a property first to save its cleaning tools.");
      setSetup(null);
      setMore(false);
      return;
    }
    const value =
      k === "calendar"
        ? ""
        : m.property
          ? "#tools-" + k
          : "#" + (k === "faqs" ? "faq" : k);
    if (value !== hash)
      history.pushState(
        { turnliTools: value.startsWith("#tools-") },
        "",
        location.pathname + location.search + value,
      );
    setHash(value);
    setMore(false);
    if (k === "calendar")
      setTimeout(() => document.getElementById("cleaningCalendar")?.focus(), 0);
  }
  function closeTools() {
    if (history.state?.turnliTools) history.back();
    else navigate("calendar");
  }
  return (
    <div className="wrap">
      <header className="brand-header">
        <Image
          className="brand-mark"
          src="/icons/turnli.svg"
          alt=""
          width={44}
          height={44}
          unoptimized
        />
        <h1>
          <span className="brand-name">turnli</span>{" "}
          <span className="hub-name">Cleaning Hub</span>
        </h1>
        <Account key={version} user={data.user} />
        <button
          className="nav-item mobile-more"
          aria-label="More"
          onClick={() => setMore(true)}
        >
          <Icon name="more" />
          <span className="nav-label">More</span>
        </button>
      </header>
      <div className="workspace-frame">
        <Sidebar
          model={m}
          calendar={calendar}
          hasOriginal={!!data.content}
          active={kind}
          navigate={navigate}
          setup={(edit) => {
            setSetup(edit ? m.property || null : null);
            setMore(false);
          }}
          mobile={mobile}
          toolsTarget={target}
        />
        <div className="workspace-main">
          <main id="homeView" className={kind === "calendar" ? "" : "hidden"}>
            <Reminder content={data.content} visible={kind === "calendar"} />
            <CleaningCalendar
              key={version}
              model={calendar}
              content={data.content}
            />
          </main>
          {kind !== "calendar" &&
            (original && data.content ? (
              <OriginalTools
                content={data.content}
                kind={kind}
                model={m}
                onClose={() => navigate("calendar")}
              />
            ) : m.property ? (
              <WorkspaceTools
                key={kind + m.property.id}
                kind={kind}
                model={m}
                onClose={closeTools}
              />
            ) : (
              <p role="status">
                {m.ready
                  ? "Add a property to set up its cleaning tools."
                  : "Loading your cleaning tools…"}
              </p>
            ))}
        </div>
      </div>
      <Dialog
        id="mobileToolsDialog"
        title="Workspace tools"
        open={more}
        onClose={() => setMore(false)}
      >
        <button className="back" onClick={() => setMore(false)}>
          Close
        </button>
        <div ref={setTarget} />
      </Dialog>
      {setup !== undefined && (
        <PropertySetup
          model={m}
          editing={setup}
          onClose={() => setSetup(undefined)}
        />
      )}
    </div>
  );
}
