# SlotWaala

SlotWaala is a WhatsApp front-desk agent for Indian service businesses. It turns customer messages into booking requests, owner-approved confirmations, and reminder workflows without asking the AI to process payments or sensitive financial documents.

## Product Thesis

Small businesses already run bookings through WhatsApp, but the inbox is messy: missed leads, incomplete details, reschedules, and manual reminders. SlotWaala gives the business a lightweight receptionist that collects the right details, prepares the next action, and keeps the owner in control.

## Core Workflow

1. A customer messages the business on WhatsApp.
2. SlotWaala classifies the intent through Mesh API.
3. The agent asks for missing booking details when needed.
4. A booking request appears in the owner dashboard.
5. The owner approves, edits, or rejects the proposed reply.
6. SlotWaala sends the approved confirmation and scheduled reminder through WhatsApp.

## Guardrails

- No payment screenshot parsing.
- No UPI, card, or bank-detail extraction.
- No auto-confirming risky or ambiguous requests.
- Human approval before customer-facing confirmations.
- Every AI call must visibly route through Mesh API.

## Stack

- Eve.dev for the agent runtime.
- Mesh API as the only AI gateway.
- Twilio WhatsApp for customer chat and reminders.
- Next.js for the owner dashboard.
- Neon Postgres for persistent state.

## Hackathon Fit

SlotWaala targets the Mesh API productivity hackathon through the Agents & Automation, Bharat, and Multi-model tracks. The product is intentionally narrow: customer intake, booking coordination, and reminders for service businesses.

## Real Environment Checks

SlotWaala includes live checks for the actual Mesh, Neon, and Twilio path.

```bash
npm run eval:preflight
npm run eval:e2e:real
```

`eval:e2e:real` is intentionally not mocked. It requires `SLOTWAALA_E2E_CUSTOMER_WHATSAPP` and sends real WhatsApp confirmation and reminder messages through Twilio.

## Mesh Model Routing

Every AI call is routed through Mesh API and stored in `mesh_traces` with the task, model, latency, input summary, and output summary. The default routing keeps routine WhatsApp work cheap while still using a stronger model for risk decisions:

- `classify_inbound`: `amazon/nova-micro-v1`
- `extract_booking_details`: `amazon/nova-lite-v1`
- `draft_customer_reply`: `amazon/nova-lite-v1`
- `check_message_policy`: `anthropic/claude-haiku-4.5`

Override these with `MESH_CLASSIFIER_MODEL`, `MESH_EXTRACTION_MODEL`, `MESH_DRAFT_MODEL`, and `MESH_POLICY_MODEL`.
