import { buildQuery, geocodeAddress } from "@/lib/geocode";
import { allowRequest, clientKey, sameSite } from "@/lib/serverGuards";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const json = (body: unknown, status: number) => Response.json(body, { status });

/** Tells the app whether address lookup is switched on (a Goong key is configured). */
export async function GET() {
  return json({ enabled: Boolean(process.env.GOONG_API_KEY && SUPABASE_URL && SUPABASE_KEY) }, 200);
}

/**
 * Looks up the map position of an address.
 *
 * Each lookup costs money, so before calling the map service this route:
 * 1. accepts requests only from this site's own pages;
 * 2. requires a signed-in user;
 * 3. uses up one unit of that user's daily allowance, counted in the database
 *    (the consume_quota function), which also proves the sign-in is genuine.
 */
export async function POST(request: Request) {
  const goongKey = process.env.GOONG_API_KEY;
  if (!goongKey || !SUPABASE_URL || !SUPABASE_KEY) return json({ ok: false, reason: "not_configured" }, 503);
  if (!sameSite(request)) return json({ ok: false, reason: "forbidden" }, 403);
  if (!allowRequest(`geocode:${clientKey(request)}`, 10, 60_000)) return json({ ok: false, reason: "too_many" }, 429);

  const token = (request.headers.get("authorization") ?? "").match(/^Bearer ([A-Za-z0-9._-]{20,4000})$/)?.[1];
  if (!token) return json({ ok: false, reason: "sign_in" }, 401);

  let address: unknown;
  let area: unknown;
  try {
    const text = await request.text();
    if (text.length > 2000) return json({ ok: false, reason: "bad_address" }, 400);
    ({ address, area } = JSON.parse(text) as { address?: unknown; area?: unknown });
  } catch {
    return json({ ok: false, reason: "bad_address" }, 400);
  }
  if (typeof address !== "string" || (area !== undefined && typeof area !== "string")) return json({ ok: false, reason: "bad_address" }, 400);
  // Checked before the allowance is touched, so a typo does not cost the user a lookup.
  if (!buildQuery(address, typeof area === "string" ? area : "")) return json({ ok: false, reason: "bad_address" }, 400);

  let allowed: unknown;
  try {
    const quota = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_quota`, {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: "geocode" }),
    });
    if (quota.status === 401 || quota.status === 403) return json({ ok: false, reason: "sign_in" }, 401);
    if (!quota.ok) return json({ ok: false, reason: "unavailable" }, 502);
    allowed = await quota.json();
  } catch {
    return json({ ok: false, reason: "unavailable" }, 502);
  }
  if (allowed !== true) return json({ ok: false, reason: "daily_limit" }, 429);

  const result = await geocodeAddress(address, typeof area === "string" ? area : "", goongKey);
  return json(result, result.ok ? 200 : result.reason === "bad_address" ? 400 : result.reason === "no_result" ? 404 : 502);
}
