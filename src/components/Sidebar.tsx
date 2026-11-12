"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Lock, LogIn, LogOut, MapPin, Plus, Search, Settings, Sparkles, Star, Store, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { APP_NAME, useT, type Key } from "@/lib/i18n";
import { cx } from "./ui";

const NAV: { href: string; key: Key; icon: typeof BookOpen }[] = [
  { href: "/", key: "navDiary", icon: BookOpen },
  { href: "/places", key: "navPlaces", icon: Store },
  { href: "/wishlist", key: "navWishlist", icon: Star },
  { href: "/map", key: "navMap", icon: MapPin },
  { href: "/taste", key: "navTaste", icon: Sparkles },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-brand text-on-brand" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11h18a9 9 0 0 1-18 0Z" />
        <path d="M9 7c0-1.5 1-1.5 1-3M14 7c0-1.5 1-1.5 1-3" />
      </svg>
    </span>
  );
}

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { t } = useT();
  const openLog = useStore((s) => s.openLog);
  const setPalette = useStore((s) => s.setPalette);
  const wishCount = useStore((s) => s.places.filter((p) => p.wishlist).length);
  const userId = useStore((s) => s.userId);
  const userEmail = useStore((s) => s.userEmail);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors";

  return (
    <nav className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-sidebar px-2 py-3" aria-label={APP_NAME}>
      <div className="mb-3 flex items-center gap-2.5 px-2.5">
        <Logo />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold leading-tight">
            {APP_NAME}
            {!userId && <span className="rounded bg-accent-soft px-1 text-[10px] font-medium text-accent">{t("demo")}</span>}
          </div>
          <div className="truncate text-xs text-muted">{t("tagline")}</div>
        </div>
      </div>

      <button type="button" className={cx(item, "text-muted hover:bg-hover")} onClick={() => { setPalette(true); onNavigate(); }}>
        <Search size={16} />
        <span className="flex-1 truncate">{t("searchHint")}</span>
        <kbd className="rounded border border-line bg-surface px-1 text-[10px] text-muted">Ctrl K</kbd>
      </button>
      <button type="button" className={cx(item, "mb-3 font-medium text-brand hover:bg-brand-soft")} onClick={() => { openLog(); onNavigate(); }}>
        <Plus size={16} />
        {t("logMeal")}
      </button>

      <ul className="space-y-0.5">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cx(item, active ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink")}>
                <Icon size={16} />
                <span className="flex-1">{t(key)}</span>
                {href === "/wishlist" && wishCount > 0 && <span className="text-xs text-muted">{wishCount}</span>}
              </Link>
            </li>
          );
        })}
        <li>
          <span className={cx(item, "cursor-default text-muted opacity-70")} title={t("twinsNote")}>
            <Users size={16} />
            <span className="flex-1">{t("navTwins")}</span>
            <span className="inline-flex items-center gap-1 text-[11px]">
              <Lock size={11} />
              {t("soon")}
            </span>
          </span>
        </li>
      </ul>

      <div className="mt-auto space-y-0.5">
        {supabase && !userId && (
          <button type="button" className={cx(item, "font-medium text-brand hover:bg-brand-soft")} onClick={() => { setAuthOpen(true); onNavigate(); }}>
            <LogIn size={16} />
            {t("signIn")}
          </button>
        )}
        {supabase && userId && (
          <div className="px-2.5 pb-1">
            <div className="truncate text-xs text-muted" title={userEmail ?? ""}>{userEmail}</div>
            <button type="button" className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink" onClick={() => supabase?.auth.signOut()}>
              <LogOut size={14} />
              {t("signOut")}
            </button>
          </div>
        )}
        <Link href="/settings" onClick={onNavigate} aria-current={pathname === "/settings" ? "page" : undefined} className={cx(item, pathname === "/settings" ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink")}>
          <Settings size={16} />
          {t("navSettings")}
        </Link>
      </div>
    </nav>
  );
}
