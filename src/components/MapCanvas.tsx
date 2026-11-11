"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from "maplibre-gl";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  /** A CSS colour, normally one of the theme variables. */
  color: string;
  label: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export const HCMC_CENTER: LatLng = { lat: 10.7769, lng: 106.7009 };

/**
 * Development map tiles from OpenStreetMap. Their servers are for light use
 * only: set NEXT_PUBLIC_MAP_STYLE_URL to a Goong or MapTiler style before launch.
 */
const DEV_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

interface Props {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** When set, clicking the map reports the clicked position. */
  onPick?: (pos: LatLng) => void;
  picked?: LatLng | null;
  me?: LatLng | null;
  focus?: (LatLng & { zoom?: number }) | null;
  className?: string;
  label: string;
}

export function MapCanvas({ points, selectedId, onSelect, onPick, picked, me, focus, className, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<MlMarker[]>([]);
  const extraRef = useRef<MlMarker[]>([]);
  const handlers = useRef({ onSelect, onPick });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    handlers.current = { onSelect, onPick };
  });

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const lib = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      lib.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      const start = focus ?? picked ?? HCMC_CENTER;
      map = new lib.Map({
        container: containerRef.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? DEV_STYLE,
        center: [start.lng, start.lat],
        zoom: 13,
        attributionControl: { compact: true },
      });
      map.addControl(new lib.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("click", (e) => handlers.current.onPick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; later changes arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = points.map((p) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `map-pin${p.id === selectedId ? " is-selected" : ""}`;
      el.style.background = p.color;
      el.setAttribute("aria-label", p.label);
      el.title = p.label;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.current.onSelect?.(p.id);
      });
      return new lib.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map);
    });
  }, [ready, points, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    extraRef.current.forEach((m) => m.remove());
    extraRef.current = [];
    if (picked) {
      const el = document.createElement("div");
      el.className = "map-pin is-selected";
      el.style.background = "var(--accent)";
      extraRef.current.push(new lib.Marker({ element: el, anchor: "bottom" }).setLngLat([picked.lng, picked.lat]).addTo(map));
    }
    if (me) {
      const el = document.createElement("div");
      el.className = "map-me";
      extraRef.current.push(new lib.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map));
    }
  }, [ready, picked, me]);

  useEffect(() => {
    if (ready && focus) mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 15 });
  }, [ready, focus]);

  // The library sets its own positioning on the map element, so sizing lives on a wrapper.
  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full" role="application" aria-label={label} />
    </div>
  );
}
