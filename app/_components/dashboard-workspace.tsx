"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  approveBooking,
  rejectBooking,
  removeAvailabilityWindow,
  requestBookingInfo,
  resolveEscalationAction,
  saveAvailabilityWindow,
  sendRecoveryOfferAction,
  sendConfirmation,
} from "@/app/actions";
import type {
  DashboardBusiness,
  DashboardEscalation,
  DashboardRecoveryOffer,
} from "@/lib/dashboard-data";
import type { AvailabilityWindow } from "@/lib/availability";
import type { BookingRequest, MeshTrace } from "@/lib/demo-data";

const statusLabel = {
  "needs-approval": "Approval",
  "needs-info": "Need info",
  approved: "Approved",
  confirmed: "Confirmed",
  rejected: "Rejected",
  escalated: "Escalated",
  canceled: "Canceled",
};

function canOwnerReview(status: BookingRequest["status"]) {
  return status === "needs-approval" || status === "needs-info";
}

type DashboardWorkspaceProps = {
  bookingRequests: BookingRequest[];
  meshTraces: MeshTrace[];
  business?: DashboardBusiness;
  availabilityWindows: AvailabilityWindow[];
  escalations: DashboardEscalation[];
  recoveryOffers: DashboardRecoveryOffer[];
};

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function DashboardWorkspace({
  bookingRequests,
  meshTraces,
  business,
  availabilityWindows,
  escalations,
  recoveryOffers,
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

      <div className="operations-grid">
        <section className="section" id="availability">
          <div className="section-header">
            <div>
              <h2 className="section-title">Service hours</h2>
              <p className="section-support">Configured hours are the only source for slot proposals.</p>
            </div>
            <span className="queue-count">{availabilityWindows.length} windows</span>
          </div>
          <div className="panel-body">
            {business ? (
              <form action={saveAvailabilityWindow} className="availability-form">
                <input name="businessId" type="hidden" value={business.id} />
                <label>
                  <span>Day</span>
                  <select defaultValue="1" name="weekday">
                    {weekdayLabels.map((label, index) => (
                      <option key={label} value={index}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Start</span>
                  <input defaultValue="10:00" name="startTime" required type="time" />
                </label>
                <label>
                  <span>End</span>
                  <input defaultValue="19:00" name="endTime" required type="time" />
                </label>
                <label>
                  <span>Slot</span>
                  <select defaultValue="30" name="slotMinutes">
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </label>
                <label className="service-field">
                  <span>Service (optional)</span>
                  <input name="service" placeholder="All services" type="text" />
                </label>
                <button className="mini-button approve availability-submit" type="submit">
                  Add hours
                </button>
              </form>
            ) : (
              <div className="empty-state compact">A business is created after the first verified WhatsApp message.</div>
            )}

            {availabilityWindows.length > 0 ? (
              <div className="availability-list">
                {availabilityWindows.map((window) => (
                  <div className="availability-row" key={window.id}>
                    <div>
                      <strong>{window.service || "All services"}</strong>
                      <span>{weekdayLabels[window.weekday]} · {window.startTime.slice(0, 5)}-{window.endTime.slice(0, 5)} · {window.slotMinutes} min</span>
                    </div>
                    <form action={removeAvailabilityWindow}>
                      <input name="availabilityWindowId" type="hidden" value={window.id} />
                      <button className="icon-button compact-icon" title="Remove service hours" type="submit" aria-label="Remove service hours">
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : business ? (
              <p className="empty-state compact">No hours configured. SlotWaala will not invent slots.</p>
            ) : null}
          </div>
        </section>

        <section className="section" id="escalations">
          <div className="section-header">
            <div>
              <h2 className="section-title">Owner escalations</h2>
              <p className="section-support">Blocked or ambiguous work stays with the owner.</p>
            </div>
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="panel-body">
            {escalations.length > 0 ? (
              <div className="escalation-list">
                {escalations.map((escalation) => (
                  <article className="escalation" key={escalation.id}>
                    <div className="escalation-heading">
                      <strong>{escalation.customerLabel}</strong>
                      <span>{escalation.categories.length > 0 ? escalation.categories.join(", ") : "owner review"}</span>
                    </div>
                    <p>{escalation.reason}</p>
                    <p className="escalation-redacted">{escalation.redactedMessage}</p>
                    {escalation.recommendedOwnerAction ? <p>{escalation.recommendedOwnerAction}</p> : null}
                    <form action={resolveEscalationAction}>
                      <input name="escalationId" type="hidden" value={escalation.id} />
                      <button className="mini-button" type="submit">Mark reviewed</button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <div className="review-zero-state compact-review">
                <ShieldCheck size={20} />
                <div>
                  <strong>No owner escalations</strong>
                  <p>High-risk requests are blocked before they reach Mesh and appear here redacted.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="section recovery-panel" id="recovery">
        <div className="section-header">
          <div>
            <h2 className="section-title">Slot recovery queue</h2>
            <p className="section-support">Released slots stay owner-approved until a waiting customer accepts.</p>
          </div>
          <span className="queue-count">{recoveryOffers.length} active</span>
        </div>
        <div className="recovery-list">
          {recoveryOffers.length > 0 ? recoveryOffers.map((offer) => (
            <article className="recovery-offer" key={offer.id}>
              <div>
                <strong>{offer.service} for {offer.customerLabel}</strong>
                <span>{formatSlot(offer.startsAt, offer.endsAt)}</span>
                <p>{offer.message}</p>
              </div>
              <div className="recovery-action">
                <span className={`pill recovery-${offer.status}`}>{offer.status === "pending_owner" ? "Owner review" : "Offer sent"}</span>
                {offer.status === "pending_owner" ? (
                  <form action={sendRecoveryOfferAction}>
                    <input name="recoveryOfferId" type="hidden" value={offer.id} />
                    <button className="mini-button approve" type="submit">Send offer</button>
                  </form>
                ) : null}
              </div>
            </article>
          )) : (
            <div className="empty-state">When a confirmed customer cancels, matching waitlist requests appear here as owner-approved offers.</div>
          )}
        </div>
      </section>
    </>
  );
}

function formatSlot(startsAt: string, endsAt: string) {
  const format = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endFormat = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${format.format(new Date(startsAt))} - ${endFormat.format(new Date(endsAt))}`;
}
