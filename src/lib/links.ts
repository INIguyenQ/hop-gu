import type { Platform } from "./types.ts";
import { humanizeSlug } from "./text.ts";

export interface ParsedLink {
  platform: Platform;
  /** The cleaned https URL, safe to store and show as a link. */
  url: string;
  name?: string;
  lat?: number;
  lng?: number;
  /** Short links hide the place details; the user must type the name. */
  short: boolean;
}

/**
 * Only links from these hosts are recognised. Anything else is ignored and
 * never stored, so a pasted link cannot point users (or, later, our server)
 * at an arbitrary site.
 */
const HOSTS: { test: (host: string) => boolean; platform: Platform; short?: boolean }[] = [
  { test: (h) => h === "maps.app.goo.gl" || h === "goo.gl", platform: "gmaps", short: true },
  { test: (h) => /^(www\.|maps\.)?google\.(com|com\.vn)$/.test(h), platform: "gmaps" },
  { test: (h) => h === "food.grab.com", platform: "grab" },
  { test: (h) => h === "r.grab.com" || h === "grab.onelink.me", platform: "grab", short: true },
  { test: (h) => h === "shopeefood.vn" || h === "www.shopeefood.vn", platform: "shopeefood" },
  { test: (h) => h === "be.com.vn" || h.endsWith(".be.com.vn"), platform: "befood", short: true },
];

export function looksLikeUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

function validCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Reads what we can from a pasted share link. Returns null for unknown sites. */
export function parseShareLink(raw: string): ParsedLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const match = HOSTS.find((h) => h.test(host));
  if (!match) return null;

  const clean = `https://${host}${url.pathname}${url.search}`.slice(0, 2000);
  const result: ParsedLink = { platform: match.platform, url: clean, short: Boolean(match.short) };
  const parts = url.pathname.split("/").filter(Boolean);

  if (match.platform === "gmaps" && !match.short) {
    if (parts[0] !== "maps") return null;
    const placeIdx = parts.indexOf("place");
    if (placeIdx >= 0 && parts[placeIdx + 1]) {
      try {
        result.name = decodeURIComponent(parts[placeIdx + 1].replace(/\+/g, " ")).trim().slice(0, 120);
      } catch {
        /* keep name undefined */
      }
    }
    const exact = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const view = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const m = exact ?? view;
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (validCoord(lat, lng)) {
        result.lat = lat;
        result.lng = lng;
      }
    }
    if (!result.name) result.short = true;
  }

  if (match.platform === "grab" && !match.short) {
    const idx = parts.indexOf("restaurant");
    const slug = idx >= 0 ? parts[idx + 1] : undefined;
    if (slug) result.name = humanizeSlug(slug.replace(/-delivery$/, "")).slice(0, 120);
    else result.short = true;
  }

  if (match.platform === "shopeefood") {
    // shopeefood.vn/<city>/<restaurant-slug>
    const slug = parts.length >= 2 && parts[0] !== "u" ? parts[parts.length - 1] : undefined;
    if (slug) result.name = humanizeSlug(slug).slice(0, 120);
    else result.short = true;
  }

  return result;
}
