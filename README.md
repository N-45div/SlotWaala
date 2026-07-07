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
6. SlotWaala sends the confirmation and scheduled reminder through WhatsApp.

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
- Supabase Postgres for persistent state.

## Hackathon Fit

SlotWaala targets the Mesh API productivity hackathon through the Agents & Automation, Bharat, and Multi-model tracks. The product is intentionally narrow: customer intake, booking coordination, and reminders for service businesses.
