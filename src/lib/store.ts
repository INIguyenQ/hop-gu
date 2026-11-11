"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import type { ChipValue, Dish, Lang, Listing, Log, Place, Platform, Theme, Verdict } from "./types.ts";
import { buildSampleData } from "./seed.ts";

/* ---- Shape checks for anything read back from browser storage ---- */

const str = (max: number) => z.string().max(max);
const listingSchema = z.object({
  platform: z.enum(["grab", "shopeefood", "befood", "gmaps", "dinein", "other"]),
  url: str(2000).regex(/^https:\/\//),
});
const placeSchema = z.object({
  id: str(64), name: str(120), area: str(80), kind: z.enum(["shop", "street"]),
  lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
  hoursNote: str(120).optional(), listings: z.array(listingSchema).max(10),
  wishlist: z.boolean(), wishNote: str(300).optional(), sample: z.boolean().optional(), createdAt: str(40),
});
const dishSchema = z.object({ id: str(64), placeId: str(64), name: str(120), typeId: str(40).nullable() });
const logSchema = z.object({
  id: str(64), dishId: str(64), placeId: str(64), verdict: z.enum(["love", "ok", "never"]),
  chips: z.record(str(40), z.union([z.literal(-1), z.literal(0), z.literal(1)])),
  tags: z.array(str(40)).max(12), note: str(1000),
  platform: z.enum(["grab", "shopeefood", "befood", "gmaps", "dinein", "other"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), createdAt: str(40),
});
const savedSchema = z.object({
  places: z.array(placeSchema).max(20000),
  dishes: z.array(dishSchema).max(100000),
  logs: z.array(logSchema).max(200000),
  lang: z.enum(["vi", "en"]),
  theme: z.enum(["system", "light", "dark"]),
});

/* ---- Inputs ---- */

export interface NewPlaceInput {
  name: string;
  area: string;
  kind: "shop" | "street";
  lat?: number;
  lng?: number;
  hoursNote?: string;
  listing?: Listing;
  wishlist?: boolean;
  wishNote?: string;
}

export interface LogItemInput {
  dishId?: string;
  name: string;
  typeId: string | null;
  verdict: Verdict;
  chips: Record<string, ChipValue>;
  tags: string[];
}

export interface MealInput {
  placeId: string;
  platform: Platform;
  date: string;
  note: string;
  items: LogItemInput[];
}

interface State {
  places: Place[];
  dishes: Dish[];
  logs: Log[];
  lang: Lang;
  theme: Theme;

  /* panels (not saved) */
  logPanel: { open: boolean; placeId?: string };
  peekPlaceId: string | null;
  paletteOpen: boolean;

  addPlace: (input: NewPlaceInput) => string;
  addListing: (placeId: string, listing: Listing) => void;
  setWishlist: (placeId: string, wishlist: boolean, note?: string) => void;
  deletePlace: (placeId: string) => void;
  addMeal: (meal: MealInput) => void;
  deleteLog: (logId: string) => void;
  clearSamples: () => void;
  clearAll: () => void;
  loadSamples: () => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  openLog: (placeId?: string) => void;
  closeLog: () => void;
  setPeek: (placeId: string | null) => void;
  setPalette: (open: boolean) => void;
}

const uid = () => crypto.randomUUID();
const clip = (s: string, max: number) => s.trim().slice(0, max);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...buildSampleData(),
      lang: "vi",
      theme: "system",
      logPanel: { open: false },
      peekPlaceId: null,
      paletteOpen: false,

      addPlace: (input) => {
        const id = uid();
        const place: Place = {
          id,
          name: clip(input.name, 120),
          area: clip(input.area, 80),
          kind: input.kind,
          lat: input.lat,
          lng: input.lng,
          hoursNote: input.hoursNote ? clip(input.hoursNote, 120) : undefined,
          listings: input.listing ? [input.listing] : [],
          wishlist: Boolean(input.wishlist),
          wishNote: input.wishNote ? clip(input.wishNote, 300) : undefined,
          createdAt: new Date().toISOString(),
        };
        set({ places: [place, ...get().places] });
        return id;
      },

      addListing: (placeId, listing) =>
        set({
          places: get().places.map((p) =>
            p.id === placeId && !p.listings.some((l) => l.url === listing.url) && p.listings.length < 10
              ? { ...p, listings: [...p.listings, listing] }
              : p,
          ),
        }),

      setWishlist: (placeId, wishlist, note) =>
        set({
          places: get().places.map((p) =>
            p.id === placeId ? { ...p, wishlist, wishNote: note !== undefined ? clip(note, 300) : p.wishNote } : p,
          ),
        }),

      deletePlace: (placeId) =>
        set({
          places: get().places.filter((p) => p.id !== placeId),
          dishes: get().dishes.filter((d) => d.placeId !== placeId),
          logs: get().logs.filter((l) => l.placeId !== placeId),
          peekPlaceId: get().peekPlaceId === placeId ? null : get().peekPlaceId,
        }),

      addMeal: (meal) => {
        const dishes = [...get().dishes];
        const logs = [...get().logs];
        const now = Date.now();
        meal.items.forEach((item, i) => {
          const name = clip(item.name, 120);
          if (!name) return;
          let dish = item.dishId ? dishes.find((d) => d.id === item.dishId && d.placeId === meal.placeId) : undefined;
          dish ??= dishes.find((d) => d.placeId === meal.placeId && d.name.toLowerCase() === name.toLowerCase());
          if (!dish) {
            dish = { id: uid(), placeId: meal.placeId, name, typeId: item.typeId };
            dishes.push(dish);
          } else if (!dish.typeId && item.typeId) {
            dish.typeId = item.typeId;
          }
          logs.push({
            id: uid(),
            dishId: dish.id,
            placeId: meal.placeId,
            verdict: item.verdict,
            chips: item.chips,
            tags: item.tags.slice(0, 12),
            note: i === 0 ? clip(meal.note, 1000) : "",
            platform: meal.platform,
            date: meal.date,
            createdAt: new Date(now + i).toISOString(),
          });
        });
        // Trying a wishlist place takes it off the wishlist.
        const places = get().places.map((p) => (p.id === meal.placeId && p.wishlist ? { ...p, wishlist: false } : p));
        set({ dishes, logs, places });
      },

      deleteLog: (logId) => set({ logs: get().logs.filter((l) => l.id !== logId) }),

      clearSamples: () => {
        const sampleIds = new Set(get().places.filter((p) => p.sample).map((p) => p.id));
        set({
          places: get().places.filter((p) => !sampleIds.has(p.id)),
          dishes: get().dishes.filter((d) => !sampleIds.has(d.placeId)),
          logs: get().logs.filter((l) => !sampleIds.has(l.placeId)),
          peekPlaceId: null,
        });
      },

      clearAll: () => set({ places: [], dishes: [], logs: [], peekPlaceId: null }),

      loadSamples: () => {
        const s = buildSampleData();
        const have = new Set(get().places.map((p) => p.id));
        if (s.places.some((p) => have.has(p.id))) return;
        set({ places: [...get().places, ...s.places], dishes: [...get().dishes, ...s.dishes], logs: [...get().logs, ...s.logs] });
      },

      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      openLog: (placeId) => set({ logPanel: { open: true, placeId }, paletteOpen: false }),
      closeLog: () => set({ logPanel: { open: false } }),
      setPeek: (peekPlaceId) => set({ peekPlaceId, paletteOpen: false }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: "hop-gu-diary-v1",
      partialize: (s) => ({ places: s.places, dishes: s.dishes, logs: s.logs, lang: s.lang, theme: s.theme }),
      // Saved data that does not pass the shape check is ignored instead of trusted.
      merge: (saved, current) => {
        const parsed = savedSchema.safeParse(saved);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

export function exportData(): string {
  const { places, dishes, logs } = useStore.getState();
  return JSON.stringify({ app: "hop-gu", version: 1, exportedAt: new Date().toISOString(), places, dishes, logs }, null, 2);
}
