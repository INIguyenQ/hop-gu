import { z } from "zod";
import { normalizeVi } from "./text.ts";

/**
 * Turns a typed address into a map position using Goong (a Vietnamese map
 * service). Runs on the server only: the Goong key is a secret and each
 * lookup costs money, so the route that calls this checks who is asking and
 * how many lookups they have left today.
 */

const ENDPOINT = "https://rsapi.goong.io/Geocode";
const TIMEOUT_MS = 6000;

// Anything outside Vietnam is treated as "not found" rather than trusted.
const VIETNAM = { minLat: 8, maxLat: 24, minLng: 102, maxLng: 110 };

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; label: string }
  | { ok: false; reason: "bad_address" | "no_result" | "unavailable" };

const replySchema = z.object({
  results: z
    .array(
      z.object({
        formatted_address: z.string().max(400).optional(),
        geometry: z.object({ location: z.object({ lat: z.number(), lng: z.number() }) }),
      }),
    )
    .max(50),
});

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** The text sent to the map service: the address, its area, and the launch city if none is named. */
export function buildQuery(address: string, area: string): string | null {
  const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const a = clean(address).slice(0, 200);
  const b = clean(area).slice(0, 80);
  if (normalizeVi(a).length < 5) return null;
  const parts = [a];
  if (b && !normalizeVi(a).includes(normalizeVi(b))) parts.push(b);
  const all = normalizeVi(parts.join(" "));
  if (!/\b(ho chi minh|hcm|sai gon|ha noi|da nang)\b/.test(all)) parts.push("TP. Hồ Chí Minh");
  return parts.join(", ");
}

export async function geocodeAddress(address: string, area: string, apiKey: string, fetchImpl: Fetch = fetch): Promise<GeocodeResult> {
  const query = buildQuery(address, area);
  if (!query) return { ok: false, reason: "bad_address" };
  const url = `${ENDPOINT}?address=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" }, redirect: "error" });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const parsed = replySchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, reason: "unavailable" };
    const first = parsed.data.results[0];
    if (!first) return { ok: false, reason: "no_result" };
    const { lat, lng } = first.geometry.location;
    if (lat < VIETNAM.minLat || lat > VIETNAM.maxLat || lng < VIETNAM.minLng || lng > VIETNAM.maxLng) return { ok: false, reason: "no_result" };
    const label = (first.formatted_address ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    return { ok: true, lat, lng, label };
  } catch {
    // The error is not passed on: it can contain the request address, which includes the key.
    return { ok: false, reason: "unavailable" };
  }
}
