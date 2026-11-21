// Browser-side API helpers. Throws with the server's error message on failure.
import type { ApiResponse } from "@/lib/api";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new Error(`Server returned ${res.status}`);
  }
  if (!json.success) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : "Something went wrong");

export const fmt = (n: number | undefined, digits = 0): string =>
  n === undefined ? "–" : n.toLocaleString(undefined, { maximumFractionDigits: digits });

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
