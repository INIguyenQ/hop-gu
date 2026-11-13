"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Store, Utensils } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { matchesQuery } from "@/lib/text";
import { latestVerdictByDish, summarizePlace } from "@/lib/derive";
import { cx, PlaceCounts, VerdictBadge } from "./ui";

type Result =
  | { kind: "place"; id: string; placeId: string; title: string; sub: string }
  | { kind: "dish"; id: string; placeId: string; title: string; sub: string; dishId: string }
  | { kind: "action"; id: string; title: string };

/** "Have I eaten here?" Opens with Ctrl/⌘ K from anywhere. */
export function CommandPalette() {
  const { t } = useT();
  const places = useStore((s) => s.places);
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const setPalette = useStore((s) => s.setPalette);
  const setPeek = useStore((s) => s.setPeek);
  const openLog = useStore((s) => s.openLog);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const verdicts = useMemo(() => latestVerdictByDish(logs), [logs]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim();
    const placeHits = places.filter((p) => !q || matchesQuery(`${p.name} ${p.area} ${p.address ?? ""}`, q)).slice(0, q ? 6 : 5);
    const out: Result[] = placeHits.map((p) => ({ kind: "place", id: `p-${p.id}`, placeId: p.id, title: p.name, sub: p.area }));
    if (q) {
      for (const d of dishes) {
        if (out.length >= 12) break;
        if (!matchesQuery(d.name, q)) continue;
        const place = places.find((p) => p.id === d.placeId);
        if (place) out.push({ kind: "dish", id: `d-${d.id}`, placeId: place.id, dishId: d.id, title: d.name, sub: place.name });
      }
    }
    out.push({ kind: "action", id: "log", title: t("logMeal") });
    return out;
  }, [query, places, dishes, t]);

  const run = (r: Result) => (r.kind === "action" ? openLog() : setPeek(r.placeId));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); run(results[active]); }
    else if (e.key === "Escape") setPalette(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t("searchHint")}>
      <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/30" onClick={() => setPalette(false)} />
      <div className="anim-pop relative w-full max-w-[580px] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={18} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value.slice(0, 80)); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchHint")}
            className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-muted"
          />
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox">
          {results.length === 1 && query && <li className="px-3 py-3 text-sm text-muted">{t("noMatch")}</li>}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => run(r)}
                className={cx("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", i === active && "bg-hover")}
              >
                {r.kind === "action" ? <Plus size={16} className="text-brand" /> : r.kind === "place" ? <Store size={16} className="text-muted" /> : <Utensils size={16} className="text-muted" />}
                <span className="min-w-0 flex-1">
                  <span className={cx("block truncate", r.kind === "action" ? "font-medium text-brand" : "font-medium")}>{r.title}</span>
                  {r.kind !== "action" && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                </span>
                {r.kind === "place" && <PlaceCounts summary={summarizePlace(r.placeId, dishes, logs)} />}
                {r.kind === "dish" && verdicts.get(r.dishId) && <VerdictBadge verdict={verdicts.get(r.dishId)!} />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
