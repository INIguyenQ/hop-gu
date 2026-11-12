import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * The browser's connection to Supabase, or null when no project is configured
 * (the app then runs in demo mode only).
 *
 * The key used here is the public "publishable" key. It grants nothing by
 * itself: every table is protected by Row Level Security in the database.
 */
// "implicit" lets an emailed sign-in link work in any browser or device. The
// stricter "pkce" method only completes in the browser that requested the
// link, so links opened from an email app silently failed to sign in.
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true } }) : null;

/**
 * Reads a failed sign-in from the address bar (for example an expired or
 * already-used link) and removes it from the address. Returns true if there was one.
 */
export function takeAuthError(): boolean {
  if (typeof window === "undefined") return false;
  const { hash, search, pathname } = window.location;
  const failed = /[#&?]error(_code|_description)?=/.test(hash) || /[?&]error(_code|_description)?=/.test(search);
  // A leftover "?code=" means a link made for the older sign-in method: it cannot be completed here.
  const stale = /[?&]code=/.test(search);
  if (failed || stale) window.history.replaceState(null, "", pathname);
  return failed || stale;
}

/**
 * Asks Supabase whether Google sign-in is switched on for this project, so the
 * button appears as soon as it is enabled in the Supabase dashboard.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!res.ok) return false;
    const settings: unknown = await res.json();
    return (settings as { external?: { google?: unknown } })?.external?.google === true;
  } catch {
    return false;
  }
}
