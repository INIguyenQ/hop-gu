/**
 * Small protections shared by the server routes.
 */

/** True when the request comes from this site's own pages (blocks other websites from using our routes). */
export function sameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The caller's network address, as reported by the hosting platform. */
export function clientKey(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

const hits = new Map<string, number[]>();

/**
 * Allows at most `max` requests per `windowMs` for one key.
 *
 * This counter lives in the memory of one server instance, so it slows down
 * a single abuser but is not a hard limit. Anything that costs money uses the
 * per-account allowance stored in the database instead (see consume_quota).
 */
export function allowRequest(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const k of hits.keys()) if (hits.size > 2500) hits.delete(k);
  return true;
}
