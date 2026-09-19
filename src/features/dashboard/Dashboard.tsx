"use client";
import { useEffect, useRef, useState } from "react";
import { request, message } from "./api";
import type { User, PrivateContent } from "./types";
import Account from "./Account";
import CleanerWorkspace from "../jobs/CleanerWorkspace";
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
    can(data.user, "cleaner.view") ? <CleanerWorkspace user={data.user} /> :
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
