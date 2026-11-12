"use client";

import { useMemo, useState } from "react";
import { BookOpen, Columns3, Plus, Table2, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { formatDate, useT, type Key } from "@/lib/i18n";
import { descriptorsFor, getDishType } from "@/lib/dishTypes";
import { sortLogs } from "@/lib/derive";
import { matchesQuery } from "@/lib/text";
import { VERDICTS, type Log, type Verdict } from "@/lib/types";
import { Page } from "@/components/AppShell";
import { Button, cx, EmptyState, PageHeader, Tag, VERDICT_STYLE, VerdictBadge, VerdictIcon } from "@/components/ui";

export default function DiaryPage() {
  const { t, lang, pick, tagLabel } = useT();
  const places = useStore((s) => s.places);
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const openLog = useStore((s) => s.openLog);
  const setPeek = useStore((s) => s.setPeek);
  const deleteLog = useStore((s) => s.deleteLog);
  const clearSamples = useStore((s) => s.clearSamples);
  const userId = useStore((s) => s.userId);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [view, setView] = useState<"table" | "board">("table");
  const [verdict, setVerdict] = useState<Verdict | "all">("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const placeMap = new Map(places.map((p) => [p.id, p]));
    const dishMap = new Map(dishes.map((d) => [d.id, d]));
    return sortLogs(logs)
      .map((log) => ({ log, dish: dishMap.get(log.dishId), place: placeMap.get(log.placeId) }))
      .filter((r) => r.dish && r.place)
      .filter((r) => verdict === "all" || r.log.verdict === verdict)
      .filter((r) => !query.trim() || matchesQuery(`${r.dish!.name} ${r.place!.name} ${r.place!.area} ${r.log.note}`, query));
  }, [places, dishes, logs, verdict, query]);

  const counts = useMemo(() => {
    const c = { love: 0, ok: 0, never: 0 };
    for (const l of logs) c[l.verdict] += 1;
    return c;
  }, [logs]);

  const hasSamples = places.some((p) => p.sample);

  const chipTags = (log: Log, typeId: string | null) => {
    const descriptors = descriptorsFor(typeId);
    return Object.entries(log.chips)
      .map(([id, value]) => {
        const d = descriptors.find((x) => x.id === id);
        return d ? `${pick(d.label)}: ${pick(d.scale[value + 1])}` : null;
      })
      .filter(Boolean) as string[];
  };

  return (
    <Page>
      <PageHeader icon={<BookOpen size={24} />} title={t("diaryTitle")} sub={t("diarySub")}
        actions={<Button variant="primary" onClick={() => openLog()}><Plus size={16} />{t("logMeal")}</Button>} />

      {!userId && (hasSamples || supabase) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-soft px-4 py-2.5 text-sm text-accent">
          <span>{t("demoBanner")} {hasSamples && t("demoBannerSamples")}</span>
          <span className="flex gap-2">
            {hasSamples && <Button small onClick={clearSamples}>{t("clearSamples")}</Button>}
            {supabase && <Button small variant="primary" onClick={() => setAuthOpen(true)}>{t("signIn")}</Button>}
          </span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-2">
        <div className="flex gap-1" role="tablist">
          {([["table", "viewTable", Table2], ["board", "viewBoard", Columns3]] as const).map(([id, key, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
              className={cx("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm", view === id ? "bg-hover font-medium" : "text-muted hover:bg-hover")}>
              <Icon size={15} />{t(key)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...VERDICTS] as const).map((v) => (
            <button key={v} type="button" aria-pressed={verdict === v} onClick={() => setVerdict(v)}
              className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
                verdict === v ? (v === "all" ? "border-ink bg-ink text-bg" : cx(VERDICT_STYLE[v].soft, "border-transparent font-medium")) : "border-line text-muted hover:bg-hover")}>
              {v !== "all" && <VerdictIcon verdict={v} size={11} />}
              {t(v)}
              <span className="opacity-70">{v === "all" ? logs.length : counts[v]}</span>
            </button>
          ))}
        </div>
        <input className="field ml-auto max-w-[200px] !py-1 text-sm" value={query} maxLength={60} placeholder={t("filter")} aria-label={t("filter")} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {logs.length === 0 ? (
        <EmptyState action={<Button variant="primary" onClick={() => openLog()}><Plus size={16} />{t("logMeal")}</Button>}>{t("emptyDiary")}</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>{t("noMatch")}</EmptyState>
      ) : view === "table" ? (
        <>
        {/* Phones get a card list; the table needs more width than they have. */}
        <ul className="space-y-2 md:hidden">
          {rows.map(({ log, dish, place }) => (
            <li key={log.id}>
              <button type="button" onClick={() => setPeek(place!.id)} className="block w-full rounded-lg border border-line bg-surface p-3 text-left">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{dish!.name}</span>
                  <VerdictBadge verdict={log.verdict} />
                </div>
                <div className="mt-0.5 text-xs text-muted">{place!.name} · {t(`p_${log.platform}` as Key)} · {formatDate(log.date, lang)}</div>
                {log.tags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{log.tags.map((tag) => <Tag key={tag} tone="accent">{tagLabel(tag)}</Tag>)}</div>}
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {(["colDish", "colPlace", "colVerdict", "colTaste", "colSource", "colDate"] as Key[]).map((k) => <th key={k} className="px-2 py-2 font-medium">{t(k)}</th>)}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ log, dish, place }) => {
                const type = getDishType(dish!.typeId);
                const chips = chipTags(log, dish!.typeId);
                return (
                  <tr key={log.id} className="group cursor-pointer border-b border-line hover:bg-hover" onClick={() => setPeek(place!.id)}>
                    <td className="px-2 py-2.5 align-top">
                      <button type="button" className="text-left font-medium" onClick={(e) => { e.stopPropagation(); setPeek(place!.id); }}>{dish!.name}</button>
                      {type && <div className="text-xs text-muted">{pick(type.name)}</div>}
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <div>{place!.name}</div>
                      <div className="text-xs text-muted">{place!.area}</div>
                    </td>
                    <td className="px-2 py-2.5 align-top"><VerdictBadge verdict={log.verdict} /></td>
                    <td className="max-w-[230px] px-2 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {chips.slice(0, 2).map((c) => <Tag key={c}>{c}</Tag>)}
                        {chips.length > 2 && <Tag>+{chips.length - 2}</Tag>}
                        {log.tags.map((tag) => <Tag key={tag} tone="accent">{tagLabel(tag)}</Tag>)}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 align-top whitespace-nowrap text-muted">{t(`p_${log.platform}` as Key)}</td>
                    <td className="px-2 py-2.5 align-top whitespace-nowrap text-muted">{formatDate(log.date, lang)}</td>
                    <td className="px-1 py-2.5 align-top">
                      <button type="button" aria-label={t("delete")} title={t("delete")} className="rounded p-1 text-muted opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(t("confirmDeleteLog"))) deleteLog(log.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {VERDICTS.filter((v) => verdict === "all" || verdict === v).map((v) => {
            const col = rows.filter((r) => r.log.verdict === v);
            return (
              <div key={v}>
                <div className="mb-2 flex items-center gap-2"><VerdictBadge verdict={v} /><span className="text-xs text-muted">{col.length}</span></div>
                <div className="space-y-2">
                  {col.map(({ log, dish, place }) => (
                    <button key={log.id} type="button" onClick={() => setPeek(place!.id)} className="block w-full rounded-lg border border-line bg-surface p-3 text-left shadow-sm hover:bg-hover">
                      <div className="font-medium">{dish!.name}</div>
                      <div className="text-xs text-muted">{place!.name} · {formatDate(log.date, lang)}</div>
                      {log.note && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{log.note}</p>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
