"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { googleEnabled, supabase } from "@/lib/supabase";
import { Button } from "./ui";
import { Logo } from "./Sidebar";

/** Sign-in window. Supabase handles the accounts; this app never sees a password. */
export function AuthDialog() {
  const { t } = useT();
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

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
    setState(error ? "error" : "sent");
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
            <Button className="mt-5 w-full !py-2" onClick={google} disabled={state === "busy"}>{t("withGoogle")}</Button>
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
      </div>
    </div>
  );
}
