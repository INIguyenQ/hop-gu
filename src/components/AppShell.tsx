"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Menu } from "lucide-react";
import { useStore } from "@/lib/store";
import { APP_NAME, useT } from "@/lib/i18n";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { LogPanel } from "./LogPanel";
import { PlacePeek } from "./PlacePeek";
import { AuthDialog } from "./AuthDialog";
import { supabase, takeAuthError } from "@/lib/supabase";

const noopSubscribe = () => () => {};

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.theme);
  const lang = useStore((s) => s.lang);
  const logOpen = useStore((s) => s.logPanel.open);
  const peekId = useStore((s) => s.peekPlaceId);
  const paletteOpen = useStore((s) => s.paletteOpen);
  const authOpen = useStore((s) => s.authOpen);
  const authReady = useStore((s) => s.authReady);
  const loading = useStore((s) => s.loading);
  const syncError = useStore((s) => s.syncError);
  const dismissSyncError = useStore((s) => s.dismissSyncError);
  const setPalette = useStore((s) => s.setPalette);
  const [navOpen, setNavOpen] = useState(false);
  // Saved data lives in the browser, so the real screen is drawn only after the page has loaded there.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { t } = useT();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    root.lang = lang;
  }, [theme, lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!useStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette]);

  // Follow sign-in and sign-out, including returning from a sign-in link.
  useEffect(() => {
    if (!supabase) return;
    const { setSession } = useStore.getState();
    const db = supabase;
    db.auth.getSession().then(({ data }) => {
      setSession(data.session?.user ?? null);
      // Arrived through a sign-in link that did not work: say so instead of failing silently.
      if (takeAuthError() && !data.session) useStore.setState({ authOpen: true, authLinkFailed: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setSession(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready || !authReady) {
    return (
      <div className="flex h-full items-center justify-center text-muted" aria-busy="true">
        {APP_NAME}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className={navOpen ? "fixed inset-0 z-30 flex md:static md:z-auto" : "hidden md:flex"}>
        <Sidebar onNavigate={() => setNavOpen(false)} />
        <button type="button" aria-label={t("close")} className="flex-1 bg-black/25 md:hidden" onClick={() => setNavOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 md:hidden">
          <button type="button" aria-label={t("menu")} className="rounded p-1.5 hover:bg-hover" onClick={() => setNavOpen(true)}>
            <Menu size={18} />
          </button>
          <span className="font-semibold">{APP_NAME}</span>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <div className="flex h-full items-center justify-center text-muted" aria-busy="true">{t("loadingDiary")}</div> : children}
        </main>
      </div>
      {peekId && <PlacePeek placeId={peekId} />}
      {logOpen && <LogPanel />}
      {paletteOpen && <CommandPalette />}
      {authOpen && <AuthDialog />}
      {/* Above every panel, so a failed save can never go unnoticed. */}
      {syncError && (
        <div className="anim-pop fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-[520px] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger shadow-pop" role="alert">
          <span className="min-w-0 flex-1">{t("syncError")}</span>
          <button type="button" className="rounded border border-danger px-2 py-0.5 font-medium hover:bg-surface" onClick={() => window.location.reload()}>{t("reloadPage")}</button>
          <button type="button" className="rounded px-2 py-0.5 font-medium hover:bg-surface" onClick={dismissSyncError}>{t("close")}</button>
        </div>
      )}
    </div>
  );
}

/** Standard page width and padding, like a Notion page. */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-10 sm:py-12">{children}</div>;
}
