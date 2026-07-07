import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { bookingRequests, meshTraces } from "@/lib/demo-data";

const statusLabel = {
  "needs-approval": "Approval",
  "needs-info": "Need info",
  confirmed: "Confirmed",
};

export default function Home() {
  const needsApproval = bookingRequests.filter(
    (request) => request.status === "needs-approval",
  ).length;
  const needsInfo = bookingRequests.filter(
    (request) => request.status === "needs-info",
  ).length;
  const confirmed = bookingRequests.filter(
    (request) => request.status === "confirmed",
  ).length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <span>SlotWaala</span>
        </div>

        <nav className="nav" aria-label="Primary">
          <div className="nav-item active">
            <Inbox size={18} />
            Queue
          </div>
          <div className="nav-item">
            <CalendarCheck size={18} />
            Bookings
          </div>
          <div className="nav-item">
            <Bell size={18} />
            Reminders
          </div>
          <div className="nav-item">
            <ShieldCheck size={18} />
            Mesh trace
          </div>
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
            <p className="subtle">
              SlotWaala drafts replies, tracks missing details, and schedules
              WhatsApp reminders after owner approval.
            </p>
          </div>
          <div className="action-row">
            <button className="button" type="button">
              <MessageCircle size={18} />
              Test WhatsApp
            </button>
            <button className="button primary" type="button">
              <Send size={18} />
              Approve draft
            </button>
          </div>
        </div>

        <section className="metrics" aria-label="Queue metrics">
          <div className="metric">
            <div className="metric-label">Needs approval</div>
            <div className="metric-value">{needsApproval}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Missing details</div>
            <div className="metric-value">{needsInfo}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Confirmed today</div>
            <div className="metric-value">{confirmed}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Due reminders</div>
            <div className="metric-value">4</div>
          </div>
        </section>

        <div className="workspace">
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Booking Queue</h2>
              <span className="subtle">{bookingRequests.length} active</span>
            </div>
            <div className="queue">
              {bookingRequests.map((request) => (
                <article className="booking-row" key={request.id}>
                  <div>
                    <p className="booking-title">
                      {request.customerName} · {request.service}
                    </p>
                    <p className="booking-meta">
                      {request.area} · {request.preferredSlot} · {request.phone}
                    </p>
                    <p className="booking-message">{request.inboundMessage}</p>
                  </div>
                  <span className={`pill ${request.status}`}>
                    {statusLabel[request.status]}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <aside className="section">
            <div className="section-header">
              <h2 className="section-title">Agent Draft</h2>
              <Clock3 size={18} />
            </div>
            <div className="panel-body">
              <div className="conversation">
                <div className="bubble">
                  <p className="bubble-label">Customer</p>
                  <p className="bubble-text">
                    {bookingRequests[0]?.inboundMessage}
                  </p>
                </div>
                <div className="bubble agent">
                  <p className="bubble-label">SlotWaala draft</p>
                  <p className="bubble-text">{bookingRequests[0]?.agentDraft}</p>
                </div>
              </div>

              <div className="trace-list">
                {meshTraces.map((trace) => (
                  <div className="trace" key={trace.id}>
                    <strong>{trace.task}</strong>
                    <span className="subtle">
                      {trace.model} · {trace.latencyMs} ms
                    </span>
                    <p className="booking-message">{trace.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
