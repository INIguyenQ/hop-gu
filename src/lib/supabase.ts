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
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } }) : null;

export const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
