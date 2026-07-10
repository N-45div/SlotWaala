# SlotWaala Architecture

SlotWaala has two public surfaces: the Next.js owner dashboard and Eve's built-in Twilio webhook. They share Neon state. Mesh API is the only AI gateway for both the Eve primary model and the structured booking tools.

## Service Topology

```mermaid
flowchart LR
  Customer[Customer on WhatsApp]
  Twilio[Twilio WhatsApp]
  Owner[Business owner]

  subgraph Vercel[Vercel deployment]
    Web[Next.js web service\nOwner dashboard]
    Eve[Eve service\n/eve/v1/twilio/messages]
  end

  Neon[(Neon Postgres)]
  Mesh[Mesh API\nOpenAI-compatible gateway]

  Customer -->|message| Twilio
  Twilio -->|signed webhook| Eve
  Eve -->|persist inbound context| Neon
  Eve -->|agent model + structured tools| Mesh
  Mesh -->|classification, extraction, draft, policy| Eve
  Eve -->|booking request and traces| Neon

  Owner -->|review and action| Web
  Web <-->|queue, conversation, traces| Neon
  Web -->|approved confirmation| Twilio
  Neon -->|due reminder| Web
  Web -->|cron delivery| Twilio
  Twilio -->|confirmation or reminder| Customer
```

Vercel routes `/eve/v1/*` to the Eve service. The remaining routes go to the Next.js web service.

## Inbound Booking Sequence

```mermaid
sequenceDiagram
  autonumber
  participant C as Customer
  participant T as Twilio WhatsApp
  participant E as Eve Twilio channel
  participant N as Neon
  participant M as Mesh API
  participant O as Owner dashboard

  C->>T: WhatsApp booking request
  T->>E: Signed POST /eve/v1/twilio/messages
  E->>N: Upsert customer, conversation, inbound message
  E->>M: Agent model and booking tools via Mesh
  M-->>E: Intent, extracted details, policy, customer draft
  E->>N: Create booking request and Mesh traces
  O->>N: Read live queue and selected trace history
  O->>N: Approve, reject, or request a detail
  alt Owner approves
    O->>T: Send approved confirmation
    O->>N: Schedule reminder
    T->>C: WhatsApp confirmation
  else Owner requests information or rejects
    O->>N: Store owner action
  end
```

## AI Routing

```mermaid
flowchart TB
  Inbound[Inbound WhatsApp context] --> EveAgent[Eve primary agent]
  EveAgent --> MeshPrimary[Mesh API primary model\nMESH_AGENT_MODEL]

  EveAgent --> Classify[classify_inbound]
  EveAgent --> Extract[extract_booking_details]
  EveAgent --> Draft[draft_customer_reply]
  EveAgent --> Policy[check_message_policy]

  Classify --> MeshFast[Mesh API\namazon/nova-micro-v1]
  Extract --> MeshLite[Mesh API\namazon/nova-lite-v1]
  Draft --> MeshLite
  Policy --> MeshReasoning[Mesh API\nanthropic/claude-haiku-4.5]

  MeshPrimary --> Trace[Persist model task, selected model, latency, summaries]
  MeshFast --> Trace
  MeshLite --> Trace
  MeshReasoning --> Trace
  Trace --> Neon[(mesh_traces)]
```

The default model names are configuration defaults, not direct provider integrations. Environment variables can override them while retaining the Mesh API base URL and key.

## Data Model

```mermaid
erDiagram
  BUSINESSES ||--o{ CUSTOMERS : serves
  BUSINESSES ||--o{ CONVERSATIONS : owns
  BUSINESSES ||--o{ BOOKING_REQUESTS : receives
  CUSTOMERS ||--o{ CONVERSATIONS : participates_in
  CUSTOMERS ||--o{ BOOKING_REQUESTS : creates
  CONVERSATIONS ||--o{ MESSAGES : contains
  CONVERSATIONS ||--o{ BOOKING_REQUESTS : provides_context
  CONVERSATIONS ||--o{ MESH_TRACES : links_context
  BOOKING_REQUESTS ||--o{ MESH_TRACES : records_work
  BOOKING_REQUESTS ||--o{ OWNER_ACTIONS : is_reviewed_by
  BOOKING_REQUESTS ||--o{ REMINDERS : schedules
  CUSTOMERS ||--o{ REMINDERS : receives

  BUSINESSES {
    uuid id PK
    text name
    text whatsapp_number
  }
  CUSTOMERS {
    uuid id PK
    uuid business_id FK
    text phone
  }
  CONVERSATIONS {
    uuid id PK
    uuid business_id FK
    uuid customer_id FK
    text channel
  }
  MESSAGES {
    uuid id PK
    uuid conversation_id FK
    text direction
    text body
  }
  BOOKING_REQUESTS {
    uuid id PK
    uuid business_id FK
    uuid customer_id FK
    uuid conversation_id FK
    text status
    text agent_draft
  }
  MESH_TRACES {
    uuid id PK
    uuid booking_request_id FK
    uuid conversation_id FK
    text task
    text model
    int latency_ms
  }
  OWNER_ACTIONS {
    uuid id PK
    uuid booking_request_id FK
    text action
  }
  REMINDERS {
    uuid id PK
    uuid booking_request_id FK
    uuid conversation_id FK
    timestamptz remind_at
    text status
  }
```

## Trust Boundaries

```mermaid
flowchart LR
  Public[Public internet] --> Twilio[Twilio signed webhook]
  Twilio --> Eve[Eve channel validation]
  Eve --> Stored[Operational booking data in Neon]
  Eve --> Mesh[Mesh API only]
  Owner[Authenticated owner workflow] --> Actions[Approve, reject, request info]
  Actions --> Stored

  Blocked[Payment or identity data] -. excluded from automation .-> Eve
  Ambiguous[Ambiguous or risky request] -. escalate .-> Owner
```

The dashboard gives the owner the final say on customer-facing confirmations. SlotWaala treats operational booking details as the automation boundary and leaves payments outside it.
