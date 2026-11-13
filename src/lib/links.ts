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
  /** Our server can open this link to read the place name (see linkResolver.ts). */
  resolvable?: boolean;
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

/** The short share link the ShopeeFood app copies: /u/ followed by a short code. */
export function isShopeeFoodShortPath(pathname: string): boolean {
  return /^\/u\/[A-Za-z0-9]{4,24}$/.test(pathname);
}

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
    // Tracking details in the address are dropped; only the path is kept.
    result.url = `https://${host}${url.pathname}`.slice(0, 2000);
    if (isShopeeFoodShortPath(url.pathname)) {
      // shopeefood.vn/u/<code>: the name is on the page behind the link.
      result.short = true;
      result.resolvable = true;
    } else if (parts[0] === "now-food" || /^\d+$/.test(parts[parts.length - 1] ?? "")) {
      // shopeefood.vn/now-food/shop/<number>: only an ID, no name anywhere.
      result.short = true;
    } else if (parts.length >= 2) {
      // shopeefood.vn/<city>/<restaurant-slug>
      result.name = humanizeSlug(parts[parts.length - 1]).slice(0, 120);
    } else {
      result.short = true;
    }
  }

  return result;
}
