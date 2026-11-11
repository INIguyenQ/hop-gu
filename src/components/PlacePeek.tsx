"use client";

import { ExternalLink, MapPin, Navigation, Plus, Star, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatDate, useT, type Key } from "@/lib/i18n";
import { getDishType } from "@/lib/dishTypes";
import { latestVerdictByDish, placeById, sortLogs, summarizePlace } from "@/lib/derive";
import { Button, PlaceCounts, SidePanel, Tag, VerdictBadge } from "./ui";

/** Place details in a side panel, like Notion's "side peek". */
export function PlacePeek({ placeId }: { placeId: string }) {
  const { t, lang, pick, tagLabel } = useT();
  const places = useStore((s) => s.places);
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const setPeek = useStore((s) => s.setPeek);
  const openLog = useStore((s) => s.openLog);
  const setWishlist = useStore((s) => s.setWishlist);
  const deletePlace = useStore((s) => s.deletePlace);
  const deleteLog = useStore((s) => s.deleteLog);

  const place = placeById(places, placeId);
  if (!place) return null;

  const placeDishes = dishes.filter((d) => d.placeId === place.id);
  const placeLogs = sortLogs(logs.filter((l) => l.placeId === place.id));
  const verdicts = latestVerdictByDish(placeLogs);
  const summary = summarizePlace(place.id, dishes, logs);
  const hasPin = place.lat !== undefined && place.lng !== undefined;

  return (
    <SidePanel title={t("navPlaces")} onClose={() => setPeek(null)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-bold leading-tight">{place.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            {place.area && <span className="inline-flex items-center gap-1"><MapPin size={13} />{place.area}</span>}
            <Tag>{t(place.kind === "shop" ? "kindShop" : "kindStreet")}</Tag>
            {place.sample && <Tag tone="accent">{t("sample")}</Tag>}
          </div>
          {place.hoursNote && <p className="mt-1.5 text-sm text-muted">{place.hoursNote}</p>}
        </div>
        <PlaceCounts summary={summary} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => openLog(place.id)}><Plus size={15} />{t("logMeal")}</Button>
        <Button onClick={() => setWishlist(place.id, !place.wishlist)} aria-pressed={place.wishlist}>
          <Star size={15} className={place.wishlist ? "text-accent" : ""} fill={place.wishlist ? "currentColor" : "none"} />
          {place.wishlist ? t("inWish") : t("addToWish")}
        </Button>
        {hasPin && (
          <a className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-hover" target="_blank" rel="noopener noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}>
            <Navigation size={15} />{t("directions")}
          </a>
        )}
      </div>
      {place.wishlist && place.wishNote && <p className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent">{place.wishNote}</p>}

      {place.listings.length > 0 && (
        <section className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("listings")}</h4>
          <div className="flex flex-wrap gap-2">
            {place.listings.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-sm hover:bg-hover">
                {t(`p_${l.platform}` as Key)}<ExternalLink size={12} />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("dishesHere")}</h4>
        {placeDishes.length === 0 ? (
          <p className="text-sm text-muted">{t("notTried")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {placeDishes.map((d) => {
              const v = verdicts.get(d.id);
              const count = placeLogs.filter((l) => l.dishId === d.id).length;
              const type = getDishType(d.typeId);
              return (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="text-xs text-muted">{type ? pick(type.name) : t("otherType")}{count > 1 && ` · ${count} ${t("times")}`}</div>
                  </div>
                  {v && <VerdictBadge verdict={v} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {placeLogs.length > 0 && (
        <section className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("history")}</h4>
          <ul className="space-y-3">
            {placeLogs.map((l) => {
              const dish = placeDishes.find((d) => d.id === l.dishId);
              return (
                <li key={l.id} className="group border-l-2 border-line pl-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{dish?.name}</span>
                    <VerdictBadge verdict={l.verdict} />
                    <span className="text-xs text-muted">{formatDate(l.date, lang)} · {t(`p_${l.platform}` as Key)}</span>
                    <button type="button" aria-label={t("delete")} title={t("delete")} className="ml-auto rounded p-1 text-muted opacity-0 hover:bg-hover hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={() => window.confirm(t("confirmDeleteLog")) && deleteLog(l.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {l.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{l.tags.map((tag) => <Tag key={tag} tone="accent">{tagLabel(tag)}</Tag>)}</div>}
                  {l.note && <p className="mt-1 text-sm text-muted">{l.note}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-8 border-t border-line pt-4">
        <Button variant="danger" small onClick={() => window.confirm(t("confirmDeletePlace")) && deletePlace(place.id)}><Trash2 size={13} />{t("delete")}</Button>
      </div>
    </SidePanel>
  );
}
