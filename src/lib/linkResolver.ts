import { isShopeeFoodShortPath } from "./links.ts";

/**
 * Opens a share link on the server to read the place name from it.
 *
 * A server that fetches addresses given by visitors can be abused to reach
 * things it should not (known as SSRF). So this is deliberately narrow:
 * - only https://shopeefood.vn/u/<code> is accepted, nothing else;
 * - redirects are followed by hand, at most twice, and only to the same host;
 * - the request has a short time limit and the reply is cut off at 64 KB;
 * - only the page title is taken from the reply, as plain text.
 */

const HOST = "shopeefood.vn";
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 2;

export type ResolveResult = { ok: true; name: string } | { ok: false; reason: "unsupported" | "unreachable" | "no_name" };

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Returns the cleaned address if it is one we are willing to open. */
export function acceptableUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== HOST) return null;
  if (url.port || url.username || url.password) return null;
  if (!isShopeeFoodShortPath(url.pathname)) return null;
  return `https://${HOST}${url.pathname}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Pulls the shared-preview title out of a page, as clean single-line text. */
export function extractTitle(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  const raw = og?.[1] ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (!raw) return null;
  const name = decodeEntities(raw)
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return name || null;
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value.subarray(0, MAX_BYTES - total));
    total += value.length;
  }
  await reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const c of chunks) {
    all.set(c.subarray(0, all.length - offset), offset);
    offset += c.length;
    if (offset >= all.length) break;
  }
  return new TextDecoder("utf-8").decode(all);
}

export async function resolveShareLink(raw: string, fetchImpl: Fetch = fetch): Promise<ResolveResult> {
  let current = acceptableUrl(raw);
  if (!current) return { ok: false, reason: "unsupported" };

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: "text/html",
          "Accept-Language": "vi",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const next: string | null = acceptableUrl(new URL(res.headers.get("location") ?? "", current).toString());
        // A redirect anywhere else (another site, another kind of page) is not followed.
        if (!next) return { ok: false, reason: "no_name" };
        current = next;
        continue;
      }
      if (!res.ok) return { ok: false, reason: "unreachable" };
      const name = extractTitle(await readLimited(res));
      return name ? { ok: true, name } : { ok: false, reason: "no_name" };
    }
    return { ok: false, reason: "no_name" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
