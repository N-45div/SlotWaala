export type InboundIntent =
  | "booking_request"
  | "reschedule"
  | "cancellation"
  | "pricing_question"
  | "service_question"
  | "complaint"
  | "other";

export type BookingRequestStatus =
  | "needs_info"
  | "needs_owner_approval"
  | "confirmed"
  | "rejected"
  | "escalated";

export type CustomerMessage = {
  from: string;
  body: string;
  receivedAt: string;
  channel: "whatsapp" | "sms" | "email";
};

export type BookingRequest = {
  id: string;
  customerPhone: string;
  customerName?: string;
  service?: string;
  area?: string;
  preferredSlot?: string;
  missingFields: string[];
  status: BookingRequestStatus;
  lastMessage: string;
  createdAt: string;
};
