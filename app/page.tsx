import {
  Bell,
  CalendarCheck,
  ClipboardCheck,
  Inbox,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { DashboardWorkspace } from "@/app/_components/dashboard-workspace";
import { requireDashboardAccess } from "@/lib/dashboard-auth";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

function formatLastUpdated(value: string) {
  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) {
    return "Last sync unavailable";
  }

  return `Synced ${updatedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function Home() {
  await requireDashboardAccess();
  const {
    bookingRequests,
    meshTraces,
    metrics,
    business,
    availabilityWindows,
    escalations,
    recoveryOffers,
    source,
    error,
    updatedAt,
  } =
    await getDashboardData();
  const needsApproval = bookingRequests.filter(
    (request) => request.status === "needs-approval",
  ).length;
  const needsInfo = bookingRequests.filter(
    (request) => request.status === "needs-info",
  ).length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <span>SlotWaala</span>
        </div>

        <nav className="nav" aria-label="Primary">
          <a className="nav-item active" href="#queue">
            <Inbox size={18} />
            Queue
          </a>
          <a className="nav-item" href="#queue">
            <CalendarCheck size={18} />
            Bookings
          </a>
          <a className="nav-item" href="#reminders">
            <Bell size={18} />
            Reminders
          </a>
          <a className="nav-item" href="#traces">
            <ShieldCheck size={18} />
            Mesh trace
          </a>
        </nav>

        <div className="sidebar-footer">
          WhatsApp first. Owner approved. No payment parsing.
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">Today&apos;s front desk</p>
            <h1>Customer messages into confirmed slots.</h1>
            <p className="subtle lead-copy">
              SlotWaala drafts replies, tracks missing details, and schedules
              WhatsApp reminders after owner approval.
            </p>
          </div>
          <div className="action-row">
            <span className={`data-source ${source}`}>
              {source === "neon" ? "Live Neon" : "Demo data"}
            </span>
            <span className="sync-status">{formatLastUpdated(updatedAt)}</span>
            <a className="icon-button" href="/" title="Refresh dashboard" aria-label="Refresh dashboard">
              <RefreshCw size={17} />
            </a>
          </div>
        </div>

        {error ? (
          <div className="notice" role="status">
            Live Neon data could not load. Showing demo data. {error}
          </div>
        ) : null}

        <section className="metrics" aria-label="Queue metrics">
          <div className="metric">
            <div className="metric-heading">
              <span className="metric-label">Needs approval</span>
              <ClipboardCheck size={17} aria-hidden="true" />
            </div>
            <div className="metric-value">{needsApproval}</div>
          </div>
          <div className="metric">
            <div className="metric-heading">
              <span className="metric-label">Missing details</span>
              <Inbox size={17} aria-hidden="true" />
            </div>
            <div className="metric-value">{needsInfo}</div>
          </div>
          <div className="metric">
            <div className="metric-heading">
              <span className="metric-label">Confirmed today</span>
              <CalendarCheck size={17} aria-hidden="true" />
            </div>
            <div className="metric-value">{metrics.confirmedToday}</div>
          </div>
          <div className="metric emphasis">
            <div className="metric-heading">
              <span className="metric-label">Due reminders</span>
              <Bell size={17} aria-hidden="true" />
            </div>
            <div className="metric-value">{metrics.dueReminders}</div>
          </div>
          <div className="metric alert-metric">
            <div className="metric-heading">
              <span className="metric-label">Owner escalations</span>
              <ShieldCheck size={17} aria-hidden="true" />
            </div>
            <div className="metric-value">{metrics.openEscalations}</div>
          </div>
        </section>

        <DashboardWorkspace
          bookingRequests={bookingRequests}
          meshTraces={meshTraces}
          business={business}
          availabilityWindows={availabilityWindows}
          escalations={escalations}
          recoveryOffers={recoveryOffers}
        />
      </main>
    </div>
  );
}
