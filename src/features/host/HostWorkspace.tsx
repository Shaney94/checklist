"use client";
import Image from "next/image";
import { hostSections } from "../../../lib/authorization.cjs";
import HostJobs from "../jobs/HostJobs";
import HostProperties from "./HostProperties";
import WorkspaceCalendar from "../calendar/WorkspaceCalendar";
import HostGuides from "../start-guide/HostGuides";
import Account from "../dashboard/Account";
import { Icon } from "../dashboard/Sidebar";
import type { User } from "../dashboard/types";
import "./host.css";

export default function HostWorkspace({ user, section }: { user: User; section: string }) {
  const selected = Object.hasOwn(hostSections, section) ? section as keyof typeof hostSections : null;
  return (
    <div className="wrap host-workspace">
      <header className="brand-header">
        <Image className="brand-mark" src="/icons/turnli.svg" alt="" width={44} height={44} unoptimized />
        <h1><span className="brand-name">turnli</span> <span className="hub-name">Host Workspace</span></h1>
        <Account user={user} />
      </header>
      <div className="workspace-frame">
        <nav className="host-navigation" aria-label="Host destinations">
          {Object.entries(hostSections).map(([key, label]) => (
            <a key={key} href={"/app/host/" + key} className={"nav-item" + (section === key ? " active" : "")} aria-current={section === key ? "page" : undefined}>
              <Icon name={key === "reservations" ? "calendar" : key === "cleaning-jobs" ? "regular" : key === "cleaning-setup" ? "deep" : "more"} />
              {label}
            </a>
          ))}
        </nav>
        <main className="workspace-main section" aria-labelledby="host-title">
          <h2 id="host-title">{selected ? hostSections[selected] : "Page unavailable"}</h2>
          {selected === "properties" ? <HostProperties /> : selected === "reservations" ? <WorkspaceCalendar /> : selected === "cleaning-jobs" ? <HostJobs /> : selected === "cleaning-setup" ? <HostGuides /> : selected === "settings" ? (
            <p>Use Account to view your account, change your password or sign out. Workspace settings are not available yet.</p>
          ) : selected ? (
            <p>{hostSections[selected]} is not available yet in the Host Workspace.</p>
          ) : <p role="alert">This workspace page is not supported.</p>}
        </main>
      </div>
    </div>
  );
}
