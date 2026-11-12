"use client";

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { isGoogleEnabled, supabase } from "@/lib/supabase";
import { Button } from "./ui";
import { Logo } from "./Sidebar";

/** Sign-in window. Supabase handles the accounts; this app never sees a password. */
export function AuthDialog() {
  const { t } = useT();
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const [email, setEmail] = useState("");
  const linkFailed = useStore((s) => s.authLinkFailed);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error" | "tooMany">("idle");

  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    isGoogleEnabled().then((on) => active && setGoogleEnabled(on));
    return () => {
      active = false;
    };
  }, []);

  if (!supabase) return null;
  const db = supabase;
  const backHere = () => window.location.origin;

  const google = async () => {
    setState("busy");
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: backHere() } });
    if (error) setState("error");
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    const { error } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: backHere() } });
    setState(!error ? "sent" : error.status === 429 ? "tooMany" : "error");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3" role="dialog" aria-modal="true" aria-label={t("signIn")}>
      <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/30" onClick={() => setAuthOpen(false)} />
      <div className="anim-pop relative w-full max-w-[400px] rounded-xl border border-line bg-surface p-6 shadow-pop">
        <button type="button" aria-label={t("close")} className="absolute right-3 top-3 rounded p-1 text-muted hover:bg-hover" onClick={() => setAuthOpen(false)}>
          <X size={16} />
        </button>
        <Logo size={36} />
        <h2 className="mt-3 text-xl font-bold">{t("signInTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("signInSub")}</p>

        {googleEnabled && (
          <>
            <Button className="mt-5 w-full !py-2" onClick={google} disabled={state === "busy"}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.500-4.800 7.200l7.700 6c4.500-4.200 6.900-10.300 6.900-17.700z"/>
                <path fill="#FBBC05" d="M10.500 28.600c-.500-1.500-.800-3-.800-4.600s.300-3.100.800-4.600l-7.900-6.200C.900 16.500 0 20.100 0 24s.900 7.500 2.600 10.800l7.900-6.200z"/>
                <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.100 1.400-4.900 2.300-8.200 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z"/>
              </svg>
              {t("withGoogle")}
            </Button>
            <div className="my-4 text-center text-xs text-muted">{t("orEmail")}</div>
          </>
        )}

        {state === "sent" ? (
          <p className="mt-5 flex gap-2 rounded-md bg-brand-soft px-3 py-2.5 text-sm text-brand" role="status"><Mail size={16} className="mt-0.5 shrink-0" />{t("linkSent")}</p>
        ) : (
          <form onSubmit={sendLink} className={googleEnabled ? "" : "mt-5"}>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">{t("emailLabel")}</span>
              <input className="field" type="email" required autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <Button type="submit" variant="primary" className="mt-3 w-full !py-2" disabled={state === "busy" || !email.trim()}><Mail size={15} />{t("sendLink")}</Button>
          </form>
        )}
        {state === "error" && <p className="mt-3 text-sm text-danger" role="alert">{t("authError")}</p>}
        {state === "tooMany" && <p className="mt-3 text-sm text-danger" role="alert">{t("authTooMany")}</p>}
        {linkFailed && state === "idle" && <p className="mt-3 text-sm text-danger" role="alert">{t("authLinkBad")}</p>}
      </div>
    </div>
  );
}
