export class APIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function request<T>(
  url: string,
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: signal || AbortSignal.timeout(20000),
  });
  if (r.status === 401) {
    location.replace("/?next=" + encodeURIComponent(location.pathname + location.hash));
    throw new APIError("Please log in again.", 401);
  }
  const data = await r.json().catch(() => { throw new APIError("The service could not respond. Please try again shortly.", r.status); });
  if (!r.ok)
    throw new APIError(data.error || "Please try again shortly.", r.status);
  return data;
}
export const message = (e: unknown) =>
  e instanceof APIError ? e.message : e instanceof Error && e.name === "TimeoutError" ? "The request timed out. Please try again." : "We couldn’t complete that request. Check your connection and try again.";
export const whatsapp = (phone: string, text: string) =>
  "https://wa.me/" +
  phone.replace(/\D/g, "") +
  "?text=" +
  encodeURIComponent(text);
