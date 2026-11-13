import { resolveShareLink } from "@/lib/linkResolver";
import { allowRequest, clientKey, sameSite } from "@/lib/serverGuards";

/** Reads the place name behind a ShopeeFood short link. See lib/linkResolver.ts for the safety rules. */
export async function POST(request: Request) {
  if (!sameSite(request)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  if (!allowRequest(`resolve:${clientKey(request)}`, 20, 60_000)) {
    return Response.json({ ok: false, reason: "too_many" }, { status: 429 });
  }

  let url: unknown;
  try {
    const text = await request.text();
    if (text.length > 4000) return Response.json({ ok: false, reason: "unsupported" }, { status: 400 });
    url = (JSON.parse(text) as { url?: unknown })?.url;
  } catch {
    return Response.json({ ok: false, reason: "unsupported" }, { status: 400 });
  }
  if (typeof url !== "string") return Response.json({ ok: false, reason: "unsupported" }, { status: 400 });

  const result = await resolveShareLink(url);
  return Response.json(result, { status: result.ok ? 200 : result.reason === "unsupported" ? 400 : 502 });
}
