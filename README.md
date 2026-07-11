# SlotWaala

SlotWaala is a WhatsApp front desk for Indian service businesses. It turns an incoming customer message into an owner-reviewed booking request, then sends the approved confirmation and reminder through WhatsApp.

It is deliberately not a payment agent. SlotWaala does not read payment screenshots, UPI IDs, card numbers, bank details, Aadhaar, or PAN data.

## The Product Loop

1. A customer messages the business on WhatsApp.
2. Twilio sends the signed webhook to Eve at `/eve/v1/twilio/messages`.
3. A deterministic gate blocks payment and identity data before it reaches Mesh. The owner sees only a redacted escalation.
4. Eve stores safe inbound context in Neon and runs the SlotWaala agent.
5. Every AI decision routes through Mesh API: classify intent, extract booking details, draft a reply, and check policy.
6. The agent checks owner-configured service hours in Neon and creates a short slot hold only for a real open slot.
7. The owner reviews the selected conversation, its Mesh traces, and the proposed reply in the dashboard.
8. Only an owner-approved booking sends a customer confirmation. A confirmed booking can schedule a WhatsApp reminder.
9. A cancellation releases the held slot and creates owner-approved WhatsApp offers for compatible waitlist entries.

## What The Owner Dashboard Shows

- A live Neon-backed booking queue with approval and missing-detail counts.
- A selected conversation review surface instead of global, unconnected draft controls.
- Per-booking Mesh traces with task, routed model, latency, and output summary.
- Reminder workload calculated from the `reminders` table, not a static number.
- Owner-managed service hours, conflict-checked slot holds, and a cancellation recovery queue.
- Explicit operational guardrails for intake, approval, and pre-Mesh payment-data blocking.

## Guardrails

- Customer-facing confirmations require owner approval.
- Ambiguous, risky, or sensitive requests can be escalated to the owner.
- Payment and identity data are detected and redacted before the message reaches Mesh or the normal booking store.
- Every model call visibly uses Mesh API. There is no direct provider key in the application.
- Twilio inbound webhook validation is handled by Eve's built-in `twilioChannel`.

## Architecture

| Responsibility | Implementation |
| --- | --- |
| Customer channel | Twilio WhatsApp |
| Agent runtime | Eve.dev |
| AI gateway | Mesh API, via its OpenAI-compatible endpoint |
| Owner surface | Next.js dashboard |
| Persistent state | Neon Postgres |
| Deployment | Vercel Services: `web` for Next.js and `eve` for the agent endpoint |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the service topology, inbound sequence, and data model diagrams.

## Mesh Routing

The Eve agent's primary model and its structured decision tools all use Mesh API. Default task routing is intentionally cost-aware:

| Task | Default Mesh model |
| --- | --- |
| `classify_inbound` | `amazon/nova-micro-v1` |
| `extract_booking_details` | `amazon/nova-lite-v1` |
| `draft_customer_reply` | `amazon/nova-lite-v1` |
| `check_message_policy` | `anthropic/claude-haiku-4.5` |

Override the routing with `MESH_AGENT_MODEL`, `MESH_FAST_MODEL`, `MESH_REASONING_MODEL`, `MESH_CLASSIFIER_MODEL`, `MESH_EXTRACTION_MODEL`, `MESH_DRAFT_MODEL`, and `MESH_POLICY_MODEL`.

## Run Locally

SlotWaala requires Node 24.

```bash
nvm use 24
npm install
cp .env.example .env.local
```

Set the required values in `.env.local`, apply [neon/schema.sql](./neon/schema.sql) to the target Neon database, then run:

```bash
npm run dev
```

For agent-specific local work:

```bash
npm run agent:dev
```

## Required Environment

Copy `.env.example`; do not commit `.env.local`.

| Variable group | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `MESH_API_KEY`, `MESH_BASE_URL` | Mesh API authentication and endpoint |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_FROM` | WhatsApp inbound and outbound delivery |
| `TWILIO_WHATSAPP_WEBHOOK_URL` | Public Eve webhook, for example `https://your-domain.vercel.app/eve/v1/twilio/messages` |
| `NEXT_PUBLIC_APP_URL` | Public web origin used by Eve/Twilio configuration |
| `DASHBOARD_ACCESS_TOKEN` | Sensitive owner token required to open the dashboard |
| `CRON_SECRET` | Authorization for the reminder cron route |

`SLOTWAALA_E2E_CUSTOMER_WHATSAPP` is only required for the real end-to-end evaluation because that check sends actual Twilio WhatsApp messages.

## Deploy And Connect Twilio

1. Deploy the repository to Vercel. `vercel.json` routes `/eve/v1/*` to Eve and all other paths to Next.js.
2. Configure the production values from `.env.example` in Vercel.
3. Set `NEXT_PUBLIC_APP_URL` and `TWILIO_WHATSAPP_WEBHOOK_URL` to the deployed origin.
4. In Twilio's WhatsApp sender or sandbox configuration, use:

   ```text
   https://your-domain.vercel.app/eve/v1/twilio/messages
   ```

5. Send a real WhatsApp booking request. It should persist in Neon and appear in the owner queue for review.

## Verification

```bash
npm run typecheck
npm run build
npm run eval:preflight
```

`npm run eval:e2e:real` is intentionally real, not mocked. It needs the Neon, Mesh, and Twilio credentials plus `SLOTWAALA_E2E_CUSTOMER_WHATSAPP`; it sends a real confirmation and reminder message to the specified WhatsApp number.

## Repository Map

| Path | Purpose |
| --- | --- |
| `agent/` | Eve agent, built-in Twilio channel, and Mesh-backed tools |
| `app/` | Next.js owner dashboard, server actions, and reminder cron route |
| `lib/` | Neon persistence, owner actions, Twilio outbound delivery, and reminders |
| `neon/schema.sql` | Persistent booking, message, trace, action, and reminder schema |
| `scripts/` | Live preflight and end-to-end evaluation scripts |
