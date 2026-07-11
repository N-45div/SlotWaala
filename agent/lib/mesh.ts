import { z } from "zod";

const MeshTraceSchema = z.object({
  task: z.string(),
  model: z.string(),
  latencyMs: z.number(),
  inputSummary: z.string(),
  outputSummary: z.string(),
});

export type MeshTrace = z.infer<typeof MeshTraceSchema>;

type MeshJsonInput = {
  task: string;
  system: string;
  prompt: string;
  schemaName: string;
  model?: string;
};

type MeshJsonResult<T> = {
  object: T;
  trace: MeshTrace;
};

const taskModelDefaults: Record<string, string> = {
  classify_inbound: "amazon/nova-micro-v1",
  extract_booking_details: "amazon/nova-lite-v1",
  draft_customer_reply: "amazon/nova-lite-v1",
  check_message_policy: "anthropic/claude-haiku-4.5",
};

const taskModelEnv: Record<string, string> = {
  classify_inbound: "MESH_CLASSIFIER_MODEL",
  extract_booking_details: "MESH_EXTRACTION_MODEL",
  draft_customer_reply: "MESH_DRAFT_MODEL",
  check_message_policy: "MESH_POLICY_MODEL",
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requireMeshConfig() {
  const apiKey = env("MESH_API_KEY");
  const baseUrl = env("MESH_BASE_URL") ?? "https://api.meshapi.ai/v1";

  if (!apiKey) {
    throw new Error("MESH_API_KEY is required. SlotWaala routes every AI call through Mesh API.");
  }

  return {
    apiKey,
    baseUrl,
    defaultModel: env("MESH_DEFAULT_MODEL") ?? "amazon/nova-lite-v1",
  };
}

export function modelForMeshTask(task: string): string {
  const taskOverride = taskModelEnv[task] ? env(taskModelEnv[task]) : undefined;
  if (taskOverride) return taskOverride;

  if (task === "check_message_policy") {
    return env("MESH_REASONING_MODEL") ?? taskModelDefaults[task];
  }

  if (task === "classify_inbound") {
    return env("MESH_FAST_MODEL") ?? taskModelDefaults[task];
  }

  return taskModelDefaults[task] ?? env("MESH_DEFAULT_MODEL") ?? "amazon/nova-lite-v1";
}

export async function generateMeshJson<T>(input: MeshJsonInput): Promise<MeshJsonResult<T>> {
  const config = requireMeshConfig();
  const model = input.model ?? modelForMeshTask(input.task) ?? config.defaultModel;
  const startedAt = Date.now();

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        {
          role: "user",
          content: `${input.prompt}\n\nReturn only JSON for schema: ${input.schemaName}.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mesh API request failed with ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Mesh API response did not include message content.");
  }

  const object = unwrapSchemaObject(parseMeshJson<T>(content, input.task), input.schemaName);
  const trace = MeshTraceSchema.parse({
    task: input.task,
    model,
    latencyMs: Date.now() - startedAt,
    inputSummary: input.prompt.slice(0, 180),
    outputSummary: content.slice(0, 180),
  });

  return { object, trace };
}

function unwrapSchemaObject<T>(value: T, schemaName: string): T {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const nested = record[schemaName];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as T;
    }
  }
  return value;
}

function parseMeshJson<T>(content: string, task: string): T {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(normalized) as T;
  } catch {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(normalized.slice(start, end + 1)) as T;
      } catch {
        // Fall through with a task-specific error below.
      }
    }

    throw new Error(`Mesh ${task} returned invalid JSON.`);
  }
}
