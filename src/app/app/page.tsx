import Dashboard from "../../features/dashboard/Dashboard";
import "../../features/dashboard/base.css";
import "../../features/dashboard/calendar.css";
import "../../features/dashboard/dashboard.css";
import "../../features/dashboard/workspace-shell.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Turnli Cleaning Hub" };
export default function DashboardPage() {
  return <Dashboard />;
}
