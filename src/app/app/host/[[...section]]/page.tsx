import Dashboard from "../../../../features/dashboard/Dashboard";
import "../../../../features/dashboard/base.css";
import "../../../../features/dashboard/calendar.css";
import "../../../../features/dashboard/dashboard.css";
import "../../../../features/dashboard/workspace-shell.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Turnli Host Workspace" };
export default async function HostPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  return <Dashboard hostSection={section?.join("/") || "properties"} />;
}
