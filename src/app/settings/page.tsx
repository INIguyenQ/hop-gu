"use client";

import { Download, LogIn, LogOut, Monitor, Moon, Settings, Sun, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { exportData, useStore } from "@/lib/store";
import { useT, type Key } from "@/lib/i18n";
import type { Lang, Theme } from "@/lib/types";
import { Page } from "@/components/AppShell";
import { Button, cx, PageHeader } from "@/components/ui";

const THEMES: { id: Theme; key: Key; icon: typeof Sun }[] = [
  { id: "system", key: "themeSystem", icon: Monitor },
  { id: "light", key: "themeLight", icon: Sun },
  { id: "dark", key: "themeDark", icon: Moon },
];
const LANGS: { id: Lang; label: string }[] = [
  { id: "vi", label: "Tiếng Việt" },
  { id: "en", label: "English" },
];

export default function SettingsPage() {
  const { t } = useT();
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const setLang = useStore((s) => s.setLang);
  const setTheme = useStore((s) => s.setTheme);
  const clearAll = useStore((s) => s.clearAll);
  const loadSamples = useStore((s) => s.loadSamples);
  const userId = useStore((s) => s.userId);
  const userEmail = useStore((s) => s.userEmail);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `hop-gu-${new Date().toLocaleDateString("en-CA")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const option = (active: boolean) =>
    cx("inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm", active ? "border-brand bg-brand-soft font-medium text-brand" : "border-line bg-surface text-muted hover:bg-hover");

  return (
    <Page>
      <PageHeader icon={<Settings size={24} />} title={t("settingsTitle")} />

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">{t("language")}</h2>
        <div className="flex gap-2" role="radiogroup" aria-label={t("language")}>
          {LANGS.map((l) => <button key={l.id} type="button" role="radio" aria-checked={lang === l.id} className={option(lang === l.id)} onClick={() => setLang(l.id)}>{l.label}</button>)}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">{t("theme")}</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("theme")}>
          {THEMES.map(({ id, key, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={theme === id} className={option(theme === id)} onClick={() => setTheme(id)}><Icon size={15} />{t(key)}</button>
          ))}
        </div>
      </section>

      {supabase && (
        <section className="mb-8">
          <h2 className="mb-2 font-semibold">{t("account")}</h2>
          {userId ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted">{t("signedInAs")} <span className="text-ink">{userEmail}</span></span>
              <Button onClick={() => supabase?.auth.signOut()}><LogOut size={15} />{t("signOut")}</Button>
            </div>
          ) : (
            <Button variant="primary" onClick={() => setAuthOpen(true)}><LogIn size={15} />{t("signIn")}</Button>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-1 font-semibold">{t("yourData")}</h2>
        <p className="mb-3 max-w-xl text-sm text-muted">{t(userId ? "cloudNote" : "dataNote")}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}><Download size={15} />{t("exportData")}</Button>
          {!userId && <Button onClick={loadSamples}>{t("loadSamples")}</Button>}
          <Button variant="danger" onClick={() => window.confirm(t("confirmDeleteAll")) && clearAll()}><Trash2 size={15} />{t("deleteAll")}</Button>
        </div>
      </section>
    </Page>
  );
}
