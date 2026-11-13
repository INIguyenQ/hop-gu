"use client";

import { useMemo, useState } from "react";
import { MapPin, Star, Store } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatDate, useT } from "@/lib/i18n";
import { summarizePlace } from "@/lib/derive";
import { matchesQuery } from "@/lib/text";
import { Page } from "@/components/AppShell";
import { EmptyState, PageHeader, PlaceCounts, Tag } from "@/components/ui";

export default function PlacesPage() {
  const { t, lang } = useT();
  const places = useStore((s) => s.places);
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const setPeek = useStore((s) => s.setPeek);
  const userId = useStore((s) => s.userId);
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () =>
      places
        .filter((p) => !query.trim() || matchesQuery(`${p.name} ${p.area} ${p.address ?? ""}`, query))
        .map((p) => ({ place: p, summary: summarizePlace(p.id, dishes, logs) }))
        // "My places": ones I have logged, wishlisted or added. A shared place I only looked at is left out.
        .filter((r) => r.summary.status || r.place.wishlist || !userId || r.place.createdBy === userId)
        .map((r) => ({ ...r, dishCount: r.summary.love + r.summary.ok + r.summary.never }))
        .sort((a, b) => (b.summary.lastDate ?? "").localeCompare(a.summary.lastDate ?? "")),
    [places, dishes, logs, query, userId],
  );

  return (
    <Page>
      <PageHeader icon={<Store size={24} />} title={t("placesTitle")} sub={t("placesSub")} />
      <div className="mb-3 border-b border-line pb-2">
        <input className="field max-w-[260px] !py-1 text-sm" value={query} maxLength={60} placeholder={t("filter")} aria-label={t("filter")} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {rows.length === 0 ? (
        <EmptyState>{places.length === 0 ? t("emptyDiary") : t("noMatch")}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ place, summary, dishCount }) => (
            <li key={place.id}>
              <button type="button" onClick={() => setPeek(place.id)} className="flex h-full w-full flex-col rounded-lg border border-line bg-surface p-4 text-left hover:bg-hover">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{place.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin size={12} className="shrink-0" /><span className="truncate">{[place.address, place.area].filter(Boolean).join(", ") || "—"}</span></div>
                  </div>
                  <PlaceCounts summary={summary} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {place.kind === "street" && <Tag>{t("kindStreet")}</Tag>}
                  {place.wishlist && <Tag tone="accent"><Star size={11} className="mr-1" />{t("navWishlist")}</Tag>}
                  {dishCount > 0 && <span>{dishCount} {t("dishes")}</span>}
                  {summary.lastDate && <span>· {t("lastVisit")}: {formatDate(summary.lastDate, lang)}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
