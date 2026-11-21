// Minimal Fireworks (OpenAI-compatible) chat client with JSON-schema output.
import type { z } from "zod";

const ENDPOINT = "https://api.fireworks.ai/inference/v1/chat/completions";

export const DEFAULT_MODEL = "accounts/fireworks/models/deepseek-v4p1-flash";
const DEFAULT_MODEL_REASONING = "none";

export interface LlmOptions {
  model?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  timeoutMs?: number;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  ms: number;
}

export interface Message {
  role: "system" | "user";
  content: string;
}

export class LlmError extends Error {}
export class LlmUnavailableError extends Error {}

/** One retry: reasoning models occasionally return empty content or a transient 5xx. */
export async function completeJson<T>(
  messages: Message[],
  schema: z.ZodType<T>,
  jsonSchema: Record<string, unknown>,
  opts: LlmOptions = {},
): Promise<{ data: T; usage: LlmUsage }> {
  try {
    return await completeOnce(messages, schema, jsonSchema, opts);
  } catch (err: unknown) {
    if (!(err instanceof LlmError) || /Fireworks 4\d\d/.test(err.message)) throw err;
    return completeOnce(messages, schema, jsonSchema, opts);
  }
}

async function completeOnce<T>(
  messages: Message[],
  schema: z.ZodType<T>,
  jsonSchema: Record<string, unknown>,
  opts: LlmOptions = {},
): Promise<{ data: T; usage: LlmUsage }> {
  const apiKey = process.env.FORMA_FIREWORKS_API_KEY;
  if (!apiKey) throw new LlmUnavailableError("AI logging is optional. Use the manual logging controls or configure FORMA_FIREWORKS_API_KEY.");

  const model = opts.model ?? process.env.FORMA_FIREWORKS_MODEL ?? DEFAULT_MODEL;
  const reasoning =
    opts.reasoningEffort ?? process.env.FORMA_FIREWORKS_REASONING ?? (model === DEFAULT_MODEL ? DEFAULT_MODEL_REASONING : undefined);
  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      max_tokens: 4000,
      ...(reasoning ? { reasoning_effort: reasoning } : {}),
      response_format: { type: "json_schema", json_schema: { name: "result", schema: jsonSchema } },
    }),
  });
  if (!res.ok) {
    throw new LlmError(`Fireworks ${res.status}: AI logging is temporarily unavailable.`);
  }
  const body = (await res.json()) as {
    choices: { message: { content: string | null } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };
  const content = body.choices[0]?.message.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new LlmError("The AI model returned invalid JSON.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new LlmError("The AI model returned an unexpected response.");
  return {
    data: result.data,
    usage: {
      promptTokens: body.usage.prompt_tokens,
      completionTokens: body.usage.completion_tokens,
      ms: Date.now() - started,
    },
  };
}
