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
    defaultModel: env("MESH_DEFAULT_MODEL") ?? env("MESH_FAST_MODEL") ?? "mesh:auto",
  };
}

export async function generateMeshJson<T>(input: MeshJsonInput): Promise<MeshJsonResult<T>> {
  const config = requireMeshConfig();
  const model = input.model ?? config.defaultModel;
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

  const object = JSON.parse(content) as T;
  const trace = MeshTraceSchema.parse({
    task: input.task,
    model,
    latencyMs: Date.now() - startedAt,
    inputSummary: input.prompt.slice(0, 180),
    outputSummary: content.slice(0, 180),
  });

  return { object, trace };
}
