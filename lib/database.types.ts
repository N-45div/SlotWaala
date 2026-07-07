export type SlotWaalaDatabase = {
  businesses: {
    Row: {
      id: string;
      name: string;
      whatsapp_number: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      whatsapp_number?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      whatsapp_number?: string | null;
      created_at?: string;
    };
  };
  customers: {
    Row: {
      id: string;
      business_id: string;
      display_name: string | null;
      phone: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      business_id: string;
      display_name?: string | null;
      phone: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      business_id?: string;
      display_name?: string | null;
      phone?: string;
      created_at?: string;
    };
  };
  conversations: {
    Row: {
      id: string;
      business_id: string;
      customer_id: string;
      channel: "whatsapp" | "sms" | "email";
      status: "open" | "closed";
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      business_id: string;
      customer_id: string;
      channel?: "whatsapp" | "sms" | "email";
      status?: "open" | "closed";
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      business_id?: string;
      customer_id?: string;
      channel?: "whatsapp" | "sms" | "email";
      status?: "open" | "closed";
      created_at?: string;
      updated_at?: string;
    };
  };
  messages: {
    Row: {
      id: string;
      conversation_id: string;
      direction: "inbound" | "outbound";
      body: string;
      external_id: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      conversation_id: string;
      direction: "inbound" | "outbound";
      body: string;
      external_id?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      conversation_id?: string;
      direction?: "inbound" | "outbound";
      body?: string;
      external_id?: string | null;
      created_at?: string;
    };
  };
  booking_requests: {
    Row: {
      id: string;
      business_id: string;
      customer_id: string;
      conversation_id: string;
      service: string | null;
      area: string | null;
      preferred_slot: string | null;
      status:
        | "needs_info"
        | "needs_owner_approval"
        | "confirmed"
        | "rejected"
        | "escalated";
      missing_fields: string[];
      agent_draft: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      business_id: string;
      customer_id: string;
      conversation_id: string;
      service?: string | null;
      area?: string | null;
      preferred_slot?: string | null;
      status?: SlotWaalaDatabase["booking_requests"]["Row"]["status"];
      missing_fields?: string[];
      agent_draft?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      business_id?: string;
      customer_id?: string;
      conversation_id?: string;
      service?: string | null;
      area?: string | null;
      preferred_slot?: string | null;
      status?: SlotWaalaDatabase["booking_requests"]["Row"]["status"];
      missing_fields?: string[];
      agent_draft?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  mesh_traces: {
    Row: {
      id: string;
      booking_request_id: string | null;
      task: string;
      model: string;
      latency_ms: number;
      input_summary: string;
      output_summary: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      booking_request_id?: string | null;
      task: string;
      model: string;
      latency_ms: number;
      input_summary: string;
      output_summary: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      booking_request_id?: string | null;
      task?: string;
      model?: string;
      latency_ms?: number;
      input_summary?: string;
      output_summary?: string;
      created_at?: string;
    };
  };
};
