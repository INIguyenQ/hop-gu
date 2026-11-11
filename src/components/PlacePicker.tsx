"use client";

import { useMemo, useState } from "react";
import { Link2, MapPin, Plus, Store, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT, type Key } from "@/lib/i18n";
import { looksLikeUrl, parseShareLink } from "@/lib/links";
import { matchesQuery } from "@/lib/text";
import { placeById, summarizePlace } from "@/lib/derive";
import type { Place } from "@/lib/types";
import { Button, cx, PlaceCounts } from "./ui";
import { MapCanvas, type LatLng } from "./MapCanvas";

const AREAS = ["Quận 1", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7", "Quận 8", "Quận 10", "Quận 11", "Quận 12", "Bình Thạnh", "Phú Nhuận", "Tân Bình", "Tân Phú", "Gò Vấp", "Bình Tân", "Thủ Đức", "Bình Chánh", "Hóc Môn", "Nhà Bè"];

interface Props {
  value?: string;
  onChange: (placeId: string | undefined) => void;
  /** New places are created on the wishlist. */
  forWishlist?: boolean;
}

export function PlacePicker({ value, onChange, forWishlist }: Props) {
  const { t } = useT();
  const places = useStore((s) => s.places);
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const addPlace = useStore((s) => s.addPlace);
  const addListing = useStore((s) => s.addListing);
  const setWishlist = useStore((s) => s.setWishlist);

  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [kind, setKind] = useState<Place["kind"]>("shop");
  const [hours, setHours] = useState("");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [showMap, setShowMap] = useState(false);

  const isUrl = looksLikeUrl(text);
  const link = useMemo(() => (isUrl ? parseShareLink(text) : null), [isUrl, text]);
  const searchText = isUrl ? (creating ? name : (link?.name ?? "")) : text;
  const matches = useMemo(
    () => (searchText.trim().length >= 2 ? places.filter((p) => matchesQuery(`${p.name} ${p.area}`, searchText)).slice(0, 5) : []),
    [places, searchText],
  );

  const selected = placeById(places, value);
  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3 py-2.5">
        <Store size={18} className="shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{selected.name}</div>
          <div className="truncate text-xs text-muted">{selected.area}</div>
        </div>
        <PlaceCounts summary={summarizePlace(selected.id, dishes, logs)} />
        <Button small variant="ghost" onClick={() => onChange(undefined)}>{t("change")}</Button>
      </div>
    );
  }

  const startCreate = (prefill: string) => {
    setName(prefill.slice(0, 120));
    if (link?.lat !== undefined && link.lng !== undefined) setPin({ lat: link.lat, lng: link.lng });
    setCreating(true);
  };

  const onText = (v: string) => {
    const next = v.slice(0, 2000);
    setText(next);
    if (looksLikeUrl(next)) {
      const parsed = parseShareLink(next);
      if (parsed) {
        setName(parsed.name ?? "");
        setPin(parsed.lat !== undefined && parsed.lng !== undefined ? { lat: parsed.lat, lng: parsed.lng } : null);
        setCreating(true);
      }
    }
  };

  const pickExisting = (p: Place) => {
    if (link) addListing(p.id, { platform: link.platform, url: link.url });
    if (forWishlist) setWishlist(p.id, true);
    onChange(p.id);
  };

  const create = () => {
    if (!name.trim()) return;
    const id = addPlace({
      name,
      area,
      kind,
      hoursNote: hours || undefined,
      lat: pin?.lat,
      lng: pin?.lng,
      listing: link ? { platform: link.platform, url: link.url } : undefined,
      wishlist: forWishlist,
    });
    onChange(id);
  };

  return (
    <div className="space-y-3">
      <input className="field" value={text} onChange={(e) => onText(e.target.value)} placeholder={t("pickPlaceHint")} aria-label={t("pickPlaceHint")} autoFocus />

      {isUrl && !link && (
        <p className="flex gap-2 rounded-md bg-okay-soft px-3 py-2 text-sm text-okay"><TriangleAlert size={16} className="mt-0.5 shrink-0" />{t("linkUnknown")}</p>
      )}
      {link && (
        <p className="flex gap-2 rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">
          <Link2 size={16} className="mt-0.5 shrink-0" />
          <span><strong>{t("linkFrom")} {t(`p_${link.platform}` as Key)}.</strong> {link.short ? t("linkShort") : t("linkCheckName")}</span>
        </p>
      )}

      {matches.length > 0 && (
        <div>
          {(creating || isUrl) && <div className="mb-1 text-xs font-medium text-muted">{t("alreadyHave")}</div>}
          <ul className="overflow-hidden rounded-lg border border-line">
            {matches.map((p) => (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => pickExisting(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover">
                  <Store size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.area}</span>
                  </span>
                  <PlaceCounts summary={summarizePlace(p.id, dishes, logs)} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!creating && !isUrl && text.trim().length >= 2 && (
        <Button onClick={() => startCreate(text.trim())}><Plus size={15} />{t("createPlace")}: “{text.trim().slice(0, 40)}”</Button>
      )}

      {creating && (
        <div className="space-y-3 rounded-lg border border-line bg-bg p-3">
          <div className="text-sm font-semibold">{t("createPlace")}</div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">{t("placeName")}</span>
            <input className="field" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">{t("area")}</span>
            <input className="field" value={area} maxLength={80} list="hcmc-areas" placeholder={t("areaHint")} onChange={(e) => setArea(e.target.value)} />
            <datalist id="hcmc-areas">{AREAS.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label={t("placeName")}>
            {(["shop", "street"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={cx("flex-1 rounded-md border px-2 py-1.5 text-sm", kind === k ? "border-brand bg-brand-soft font-medium text-brand" : "border-line bg-surface text-muted hover:bg-hover")}>
                {t(k === "shop" ? "kindShop" : "kindStreet")}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">{t("hours")}</span>
            <input className="field" value={hours} maxLength={120} placeholder={t("hoursHint")} onChange={(e) => setHours(e.target.value)} />
          </label>
          <div>
            <Button small onClick={() => setShowMap((v) => !v)}><MapPin size={14} />{pin ? t("pinSet") : t("pin")}</Button>
            {showMap && (
              <div className="mt-2">
                <MapCanvas label={t("pin")} className="h-52 w-full overflow-hidden rounded-md border border-line" points={[]} picked={pin} onPick={setPin} />
                <p className="mt-1 text-xs text-muted">{t("pinHint")}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>{t("cancel")}</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={create}>{t("usePlace")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
