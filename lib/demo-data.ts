export type BookingStatus =
  | "needs-approval"
  | "needs-info"
  | "approved"
  | "confirmed"
  | "rejected"
  | "escalated";

export type BookingRequest = {
  id: string;
  customerName: string;
  phone: string;
  service: string;
  area: string;
  preferredSlot: string;
  status: BookingStatus;
  inboundMessage: string;
  agentDraft: string;
};

export type MeshTrace = {
  id: string;
  task: string;
  model: string;
  latencyMs: number;
  summary: string;
};

export const bookingRequests: BookingRequest[] = [
  {
    id: "bk_1042",
    customerName: "Rhea Sharma",
    phone: "whatsapp:+919810000421",
    service: "Salon appointment",
    area: "Indiranagar",
    preferredSlot: "Today, 5-7 PM",
    status: "needs-approval",
    inboundMessage:
      "Hi, eyebrow threading and haircut possible today evening? Indiranagar side.",
    agentDraft:
      "Yes, we can help. We have a 6:15 PM slot today. Please confirm if that works for you.",
  },
  {
    id: "bk_1041",
    customerName: "Amit Verma",
    phone: "whatsapp:+919810000389",
    service: "AC service",
    area: "Koramangala",
    preferredSlot: "Tomorrow afternoon",
    status: "needs-info",
    inboundMessage:
      "AC servicing chahiye kal afternoon. Split AC hai, cooling kam ho raha hai.",
    agentDraft:
      "Sure. Please share your building name and whether it is a 1 ton, 1.5 ton, or 2 ton AC.",
  },
  {
    id: "bk_1040",
    customerName: "Nisha Classes",
    phone: "whatsapp:+919810000214",
    service: "Trial class",
    area: "Online",
    preferredSlot: "Friday, 7 PM",
    status: "confirmed",
    inboundMessage:
      "Need a maths trial class for class 9 student. Friday evening works.",
    agentDraft:
      "Your trial class is confirmed for Friday at 7 PM. We will send a reminder 1 hour before the class.",
  },
];

export const meshTraces: MeshTrace[] = [
  {
    id: "trace_910",
    task: "classify_inbound",
    model: "amazon/nova-micro-v1",
    latencyMs: 812,
    summary: "Detected booking request with preferred same-day evening slot.",
  },
  {
    id: "trace_911",
    task: "check_message_policy",
    model: "anthropic/claude-haiku-4.5",
    latencyMs: 1290,
    summary: "Area and service found; exact slot requires owner approval.",
  },
  {
    id: "trace_912",
    task: "draft_customer_reply",
    model: "amazon/nova-lite-v1",
    latencyMs: 1044,
    summary: "Drafted a concise WhatsApp confirmation in friendly business tone.",
  },
];
