"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import {
  approveBooking,
  rejectBooking,
  requestBookingInfo,
  sendConfirmation,
} from "@/app/actions";
import type { BookingRequest, MeshTrace } from "@/lib/demo-data";

const statusLabel = {
  "needs-approval": "Approval",
  "needs-info": "Need info",
  approved: "Approved",
  confirmed: "Confirmed",
  rejected: "Rejected",
  escalated: "Escalated",
};

function canOwnerReview(status: BookingRequest["status"]) {
  return status === "needs-approval" || status === "needs-info";
}

type DashboardWorkspaceProps = {
  bookingRequests: BookingRequest[];
  meshTraces: MeshTrace[];
};

export function DashboardWorkspace({
  bookingRequests,
  meshTraces,
}: DashboardWorkspaceProps) {
  const firstActionable = bookingRequests.find((request) => canOwnerReview(request.status));
  const [selectedBookingId, setSelectedBookingId] = useState(firstActionable?.id ?? bookingRequests[0]?.id);
  const selectedBooking = bookingRequests.find((request) => request.id === selectedBookingId);
  const selectedTraces = useMemo(
    () => meshTraces.filter((trace) => !trace.bookingRequestId || trace.bookingRequestId === selectedBookingId),
    [meshTraces, selectedBookingId],
  );

  return (
    <>
      <div className="workspace">
        <section className="section" id="queue">
          <div className="section-header">
            <div>
              <h2 className="section-title">Booking queue</h2>
              <p className="section-support">Owner review is required before a slot is confirmed.</p>
            </div>
            <span className="queue-count">{bookingRequests.length} active</span>
          </div>
          <div className="queue">
            {bookingRequests.length > 0 ? (
              bookingRequests.map((request) => {
                const isSelected = request.id === selectedBookingId;

                return (
                  <article className={`booking-row ${isSelected ? "selected" : ""}`} key={request.id}>
                    <div>
                      <button
                        className="booking-select"
                        onClick={() => setSelectedBookingId(request.id)}
                        type="button"
                      >
                        <span className="booking-title">
                          {request.customerName} · {request.service}
                        </span>
                        <span className="booking-meta">
                          {request.area} · {request.preferredSlot} · {request.phone}
                        </span>
                        <span className="booking-message">{request.inboundMessage}</span>
                      </button>
                      {isSelected && canOwnerReview(request.status) ? (
                        <div className="owner-controls">
                          <form action={approveBooking}>
                            <input name="bookingRequestId" type="hidden" value={request.id} />
                            <input name="draftText" type="hidden" value={request.agentDraft} />
                            <button className="mini-button approve" type="submit">
                              Approve + send
                            </button>
                          </form>
                          <form action={requestBookingInfo}>
                            <input name="bookingRequestId" type="hidden" value={request.id} />
                            <input
                              name="note"
                              type="hidden"
                              value="Owner requested one more customer detail."
                            />
                            <button className="mini-button" type="submit">
                              Ask for detail
                            </button>
                          </form>
                          <form action={rejectBooking}>
                            <input name="bookingRequestId" type="hidden" value={request.id} />
                            <button className="mini-button reject" type="submit">
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : null}
                      {isSelected && request.status === "approved" ? (
                        <div className="owner-controls">
                          <form action={sendConfirmation}>
                            <input name="bookingRequestId" type="hidden" value={request.id} />
                            <input name="draftText" type="hidden" value={request.agentDraft} />
                            <button className="mini-button approve" type="submit">
                              Send confirmation
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                    <span className={`pill ${request.status}`}>{statusLabel[request.status]}</span>
                  </article>
                );
              })
            ) : (
              <div className="queue-zero-state">
                <div className="queue-zero-icon">
                  <MessageCircle size={22} />
                </div>
                <div>
                  <strong>Inbox is ready for its first booking.</strong>
                  <p>Verified WhatsApp requests will appear here for owner review.</p>
                </div>
                <div className="intake-checks" aria-label="Intake readiness">
                  <span><CheckCircle2 size={15} /> WhatsApp intake online</span>
                  <span><CheckCircle2 size={15} /> Owner approval enabled</span>
                  <span><ShieldCheck size={15} /> Payment data blocked</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="section" id="traces">
          <div className="section-header">
            <div>
              <h2 className="section-title">Conversation review</h2>
              <p className="section-support">Selected booking and its Mesh work.</p>
            </div>
            <Clock3 size={18} aria-hidden="true" />
          </div>
          <div className="panel-body">
            {selectedBooking ? (
              <div className="conversation">
                <div className="bubble">
                  <p className="bubble-label">Customer · {selectedBooking.customerName}</p>
                  <p className="bubble-text">{selectedBooking.inboundMessage}</p>
                </div>
                <div className="bubble agent">
                  <p className="bubble-label">SlotWaala draft</p>
                  <p className="bubble-text">{selectedBooking.agentDraft}</p>
                </div>
              </div>
            ) : (
              <div className="review-zero-state">
                <MessageCircle size={20} />
                <div>
                  <strong>No active conversation</strong>
                  <p>New WhatsApp context will be reviewed here after Mesh classifies it.</p>
                </div>
              </div>
            )}

            <div className="trace-list">
              <div className="trace-title-row">
                <span>Mesh trace</span>
                <span>{selectedTraces.length} steps</span>
              </div>
              {selectedTraces.length > 0 ? (
                selectedTraces.map((trace) => (
                  <div className="trace" key={trace.id}>
                    <strong>{trace.task}</strong>
                    <span className="subtle">
                      {trace.model} · {trace.latencyMs} ms
                    </span>
                    <p className="booking-message">{trace.summary}</p>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">No Mesh steps recorded for this booking yet.</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="operations-strip" id="reminders" aria-label="Operational status">
        <div>
          <span className="operations-kicker">Intake</span>
          <strong>WhatsApp to owner review</strong>
          <p>Every customer request is stored before the agent decides the next step.</p>
        </div>
        <div>
          <span className="operations-kicker">Guardrail</span>
          <strong>Payment data stays out</strong>
          <p>Booking context is operational only. Payment and identity data are blocked.</p>
        </div>
        <div>
          <span className="operations-kicker">Follow-up</span>
          <strong>Reminders stay queued</strong>
          <p>Only confirmed bookings can schedule WhatsApp follow-ups.</p>
        </div>
      </section>
    </>
  );
}
