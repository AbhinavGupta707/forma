// Shared helpers for route handlers: consistent JSON envelope and zod body parsing.
import { z } from "zod";
import { isIsoDate, MEALS } from "./dates";
import { LlmError, LlmUnavailableError } from "./parse/llm";
import { NotFoundError } from "./log";
import { EmptyWorkoutError } from "./train/workouts";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const ok = <T>(data: T, status = 200): Response =>
  Response.json({ success: true, data } satisfies ApiResponse<T>, { status });

export const fail = (status: number, error: string): Response =>
  Response.json({ success: false, error } satisfies ApiResponse<never>, { status });

class BadRequest extends Error {}

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new BadRequest("Body must be JSON");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new BadRequest(z.prettifyError(r.error));
  return r.data;
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequest(`Invalid id: ${raw}`);
  return id;
}

export function queryDate(req: Request, name = "date"): string {
  const v = new URL(req.url).searchParams.get(name);
  if (!v || !isIsoDate(v)) throw new BadRequest(`Query param "${name}" must be YYYY-MM-DD`);
  return v;
}

/** Wrap a handler so known errors map to status codes and nothing leaks a stack trace. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err: unknown) {
      if (err instanceof BadRequest || err instanceof EmptyWorkoutError) return fail(400, err.message);
      if (err instanceof NotFoundError) return fail(404, err.message);
      if (err instanceof LlmUnavailableError) return fail(503, err.message);
      if (err instanceof LlmError) return fail(502, err.message);
      if (err instanceof Error && err.name === "TimeoutError") return fail(504, "The AI model timed out, try again");
      console.error(err);
      return fail(500, "Unexpected server error");
    }
  };
}

export const dateSchema = z.string().refine(isIsoDate, "Expected YYYY-MM-DD");
export const mealSchema = z.enum(MEALS);
