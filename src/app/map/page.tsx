"use client";

import { useMemo, useState } from "react";
import { LocateFixed, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT, type Key } from "@/lib/i18n";
import { summarizePlace } from "@/lib/derive";
import { distanceMeters } from "@/lib/text";
import { MapCanvas, type LatLng, type MapPoint } from "@/components/MapCanvas";
import { Button, cx, PlaceCounts } from "@/components/ui";

type Layer = "love" | "ok" | "never" | "wish";
const LAYERS: { id: Layer; key: Key; color: string }[] = [
  { id: "love", key: "layerLove", color: "var(--brand)" },
  { id: "never", key: "layerNever", color: "var(--danger)" },
  { id: "wish", key: "layerWish", color: "var(--accent)" },
  { id: "ok", key: "layerOk", color: "var(--okay)" },
];

export default function MapPage() {
  const { t } = useT();
  const places = useStore((s) => s.places);
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const setPeek = useStore((s) => s.setPeek);

  const [on, setOn] = useState<Record<Layer, boolean>>({ love: true, never: true, wish: true, ok: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<(LatLng & { zoom?: number }) | null>(null);
  const [locError, setLocError] = useState(false);

  const { points, missing } = useMemo(() => {
    const pts: (MapPoint & { layer: Layer })[] = [];
    let noPin = 0;
    for (const p of places) {
      const s = summarizePlace(p.id, dishes, logs);
      const layer: Layer | null = s.status ?? (p.wishlist ? "wish" : null);
      if (!layer) continue;
      if (p.lat === undefined || p.lng === undefined) { noPin += 1; continue; }
      pts.push({ id: p.id, lat: p.lat, lng: p.lng, label: p.name, layer, color: LAYERS.find((l) => l.id === layer)!.color });
    }
    return { points: pts, missing: noPin };
  }, [places, dishes, logs]);

  const visible = useMemo(() => points.filter((p) => on[p.layer]), [points, on]);
  const selected = places.find((p) => p.id === selectedId);

  // Location is read once, on request, and kept only in this page's memory.
  const locate = () => {
    if (!navigator.geolocation) return setLocError(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        setFocus({ ...here, zoom: 15 });
        setLocError(false);
      },
      () => setLocError(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="relative h-full min-h-[420px]">
      <MapCanvas label={t("mapTitle")} className="absolute inset-0" points={visible} selectedId={selectedId} onSelect={setSelectedId} me={me} focus={focus} />

      <div className="absolute left-3 top-3 w-[230px] rounded-xl border border-line bg-surface p-3 shadow-pop">
        <h1 className="mb-2 text-base font-bold">{t("mapTitle")}</h1>
        <div className="mb-1 text-xs font-medium text-muted">{t("layers")}</div>
        <ul className="space-y-1">
          {LAYERS.map((l) => (
            <li key={l.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={on[l.id]} onChange={(e) => setOn({ ...on, [l.id]: e.target.checked })} className="accent-[var(--brand)]" />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                <span className="flex-1">{t(l.key)}</span>
                <span className="text-xs text-muted">{points.filter((p) => p.layer === l.id).length}</span>
              </label>
            </li>
          ))}
          <li className="flex items-center gap-2 text-sm text-muted opacity-70" title={t("twinsNote")}>
            <Lock size={13} />
            <span className="flex-1">{t("layerTwins")}</span>
            <span className="text-[11px]">{t("soon")}</span>
          </li>
        </ul>
        <Button className="mt-3 w-full" onClick={locate}><LocateFixed size={15} />{t("nearMe")}</Button>
        <p className={cx("mt-2 text-xs", locError ? "text-danger" : "text-muted")}>{locError ? t("locDenied") : t("locPrivacy")}</p>
        {missing > 0 && <p className="mt-1 text-xs text-muted">{missing} {t("noPin")}</p>}
      </div>

      {selected && (
        <div className="anim-pop absolute bottom-4 left-3 right-3 mx-auto flex max-w-[420px] items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-pop">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{selected.name}</div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>{selected.area}</span>
              {me && selected.lat !== undefined && selected.lng !== undefined && <span>· {Math.round(distanceMeters(me, { lat: selected.lat, lng: selected.lng }) / 10) * 10} m</span>}
            </div>
          </div>
          <PlaceCounts summary={summarizePlace(selected.id, dishes, logs)} />
          <Button variant="primary" small onClick={() => setPeek(selected.id)}>{t("open")}</Button>
        </div>
      )}
    </div>
  );
}
