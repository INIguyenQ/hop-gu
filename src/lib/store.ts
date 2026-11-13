"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import type { ChipValue, Dish, Lang, Listing, Log, Place, Platform, Theme, Verdict } from "./types.ts";
import { buildSampleData } from "./seed.ts";
import { dataSchema } from "./schemas.ts";
import { supabase } from "./supabase.ts";
import { createRemote, type ReportReason } from "./remote.ts";

/**
 * Two modes:
 * - Demo (signed out): the diary lives in this browser only.
 * - Account (signed in): the diary lives in Supabase. Every change is shown
 *   at once and saved in the background; if a save fails, the screen is
 *   reloaded from the database so it never shows something that was not saved.
 */

interface Data {
  places: Place[];
  dishes: Dish[];
  logs: Log[];
}

const savedSchema = z.object({ lang: z.enum(["vi", "en"]), theme: z.enum(["system", "light", "dark"]), demo: dataSchema });
/** The first prototype saved the diary at the top level. */
const savedSchemaV1 = dataSchema.extend({ lang: z.enum(["vi", "en"]), theme: z.enum(["system", "light", "dark"]) });

const remote = supabase ? createRemote(supabase) : null;

export interface NewPlaceInput {
  name: string;
  area: string;
  address?: string;
  kind: "shop" | "street";
  /** Only meaningful when signed in. Defaults to shared. */
  visibility?: "shared" | "private";
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

interface State extends Data {
  lang: Lang;
  theme: Theme;

  /* account (not saved in the browser by this store) */
  userId: string | null;
  userEmail: string | null;
  /** False until we know whether someone is signed in. */
  authReady: boolean;
  loading: boolean;
  syncError: boolean;
  /** The browser-only diary, set aside while an account is in use. */
  demoBackup: Data | null;

  /* panels (not saved) */
  logPanel: { open: boolean; placeId?: string };
  peekPlaceId: string | null;
  paletteOpen: boolean;
  authOpen: boolean;
  /** True when the visitor arrived through a sign-in link that did not work. */
  authLinkFailed: boolean;

  setSession: (user: { id: string; email?: string | null } | null) => Promise<void>;
  dismissSyncError: () => void;
  addPlace: (input: NewPlaceInput) => string;
  addListing: (placeId: string, listing: Listing) => void;
  setWishlist: (placeId: string, wishlist: boolean, note?: string) => void;
  /** Removes a place from my diary (my logs and wishlist entry for it). */
  deletePlace: (placeId: string) => void;
  /** Looks for shared places matching a name or address, and ones pinned near a point. */
  findShared: (query: string, near?: { lat: number; lng: number } | null) => Promise<Place[]>;
  /** Brings a shared place found by search into view so it can be logged or wishlisted. */
  adoptPlace: (place: Place) => void;
  reportPlace: (placeId: string, reason: ReportReason) => Promise<boolean>;
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
  setAuthOpen: (open: boolean) => void;
}

const uid = () => crypto.randomUUID();
const clip = (s: string, max: number) => s.trim().slice(0, max);
const EMPTY: Data = { places: [], dishes: [], logs: [] };

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Reloads the signed-in user's diary from the database. */
      const reload = async (userId: string) => {
        if (!remote) return;
        const data = await remote.fetchAll(userId);
        if (get().userId === userId) set({ ...data, loading: false });
      };

      let queue: Promise<void> = Promise.resolve();

      /** Saves a change in the background when signed in. */
      const push = (save: (r: NonNullable<typeof remote>) => Promise<void>) => {
        const userId = get().userId;
        if (!remote || !userId) return;
        // Saves run one after another, in the order the changes were made:
        // a dish must not reach the database before the place it belongs to.
        queue = queue
          .then(() => save(remote))
          .catch(async (error) => {
            console.error("Saving failed", error);
            set({ syncError: true });
            await reload(userId).catch(() => undefined);
          });
      };

      const updatePlace = (placeId: string, change: (p: Place) => Place) => {
        let changed: Place | undefined;
        set({
          places: get().places.map((p) => {
            if (p.id !== placeId) return p;
            changed = change(p);
            return changed;
          }),
        });
        if (changed) {
          const place = changed;
          push((r) => r.updatePlace(place));
        }
      };

      return {
        ...buildSampleData(),
        lang: "vi",
        theme: "system",
        userId: null,
        userEmail: null,
        authReady: !supabase,
        loading: false,
        syncError: false,
        demoBackup: null,
        logPanel: { open: false },
        peekPlaceId: null,
        paletteOpen: false,
        authOpen: false,
        authLinkFailed: false,

        setSession: async (user) => {
          const current = get().userId;
          if (user && user.id !== current) {
            const { places, dishes, logs } = get();
            set({
              demoBackup: current ? get().demoBackup : { places, dishes, logs },
              ...EMPTY,
              userId: user.id,
              userEmail: user.email ?? null,
              authReady: true,
              loading: true,
              syncError: false,
              peekPlaceId: null,
              authOpen: false,
            });
            try {
              await reload(user.id);
            } catch (error) {
              console.error("Loading failed", error);
              if (get().userId === user.id) set({ loading: false, syncError: true });
            }
          } else if (!user && current) {
            set({ ...(get().demoBackup ?? EMPTY), demoBackup: null, userId: null, userEmail: null, authReady: true, loading: false, syncError: false, peekPlaceId: null });
          } else {
            set({ authReady: true });
          }
        },

        dismissSyncError: () => set({ syncError: false }),

        addPlace: (input) => {
          const place: Place = {
            id: uid(),
            name: clip(input.name, 120),
            area: clip(input.area, 80),
            address: input.address ? clip(input.address, 200) : undefined,
            kind: input.kind,
            visibility: get().userId ? (input.visibility ?? "shared") : undefined,
            createdBy: get().userId ?? undefined,
            lat: input.lat,
            lng: input.lng,
            hoursNote: input.hoursNote ? clip(input.hoursNote, 120) : undefined,
            listings: input.listing ? [input.listing] : [],
            wishlist: Boolean(input.wishlist),
            wishNote: input.wishNote ? clip(input.wishNote, 300) : undefined,
            createdAt: new Date().toISOString(),
          };
          set({ places: [place, ...get().places] });
          push((r) => r.insertPlace(place));
          if (place.wishlist) push((r) => r.setWishlist(place.id, true, place.wishNote ?? ""));
          return place.id;
        },

        // Links are part of the shared place, so only its creator can add one (anyone can in demo mode).
        addListing: (placeId, listing) => {
          const userId = get().userId;
          const place = get().places.find((p) => p.id === placeId);
          if (!place || (userId && place.createdBy !== userId)) return;
          updatePlace(placeId, (p) =>
            p.listings.some((l) => l.url === listing.url) || p.listings.length >= 10 ? p : { ...p, listings: [...p.listings, listing] },
          );
        },

        setWishlist: (placeId, wishlist, note) => {
          let saved: Place | undefined;
          set({
            places: get().places.map((p) => {
              if (p.id !== placeId) return p;
              saved = { ...p, wishlist, wishNote: note !== undefined ? clip(note, 300) : p.wishNote };
              return saved;
            }),
          });
          const wishNote = saved?.wishNote ?? "";
          if (saved) push((r) => r.setWishlist(placeId, wishlist, wishNote));
        },

        deletePlace: (placeId) => {
          set({
            places: get().places.filter((p) => p.id !== placeId),
            dishes: get().dishes.filter((d) => d.placeId !== placeId),
            logs: get().logs.filter((l) => l.placeId !== placeId),
            peekPlaceId: get().peekPlaceId === placeId ? null : get().peekPlaceId,
          });
          push((r) => r.removeFromDiary(placeId));
        },

        findShared: async (query, near) => {
          if (!remote || !get().userId) return [];
          try {
            const [byName, byPin] = await Promise.all([
              query.trim().length >= 2 ? remote.searchPlaces(query) : Promise.resolve([]),
              near ? remote.nearbyPlaces(near.lat, near.lng) : Promise.resolve([]),
            ]);
            const seen = new Set<string>();
            return [...byName, ...byPin].filter((p) => !seen.has(p.id) && seen.add(p.id));
          } catch (error) {
            console.error("Search failed", error);
            return [];
          }
        },

        adoptPlace: (place) => {
          if (get().places.some((p) => p.id === place.id)) return;
          set({ places: [place, ...get().places] });
          const userId = get().userId;
          if (!remote || !userId) return;
          remote
            .fetchDishes(place.id)
            .then((found) => {
              if (get().userId !== userId) return;
              const have = new Set(get().dishes.map((d) => d.id));
              set({ dishes: [...get().dishes, ...found.filter((d) => !have.has(d.id))] });
            })
            .catch((error) => console.error("Loading dishes failed", error));
        },

        reportPlace: async (placeId, reason) => {
          if (!remote || !get().userId) return false;
          try {
            await remote.reportPlace(placeId, reason);
            return true;
          } catch (error) {
            console.error("Report failed", error);
            return false;
          }
        },

        addMeal: (meal) => {
          const dishes = [...get().dishes];
          const newDishes: Dish[] = [];
          const changedDishes: Dish[] = [];
          const newLogs: Log[] = [];
          const now = Date.now();
          meal.items.forEach((item, i) => {
            const name = clip(item.name, 120);
            if (!name) return;
            let index = item.dishId ? dishes.findIndex((d) => d.id === item.dishId && d.placeId === meal.placeId) : -1;
            if (index < 0) index = dishes.findIndex((d) => d.placeId === meal.placeId && d.name.toLowerCase() === name.toLowerCase());
            let dish: Dish;
            if (index < 0) {
              dish = { id: uid(), placeId: meal.placeId, name, typeId: item.typeId };
              dishes.push(dish);
              newDishes.push(dish);
            } else if (!dishes[index].typeId && item.typeId) {
              dish = { ...dishes[index], typeId: item.typeId };
              dishes[index] = dish;
              if (!newDishes.some((d) => d.id === dish.id)) changedDishes.push(dish);
            } else {
              dish = dishes[index];
            }
            newLogs.push({
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
          set({ dishes, logs: [...get().logs, ...newLogs] });
          const userId = get().userId;
          push(async (r) => {
            const saved = await r.saveMeal(meal.placeId, newDishes, newLogs);
            for (const d of changedDishes) if (d.typeId) await r.setDishType(d.id, d.typeId);
            if (get().userId !== userId) return;
            // Someone else may already have added a dish with this name: use the shared entry.
            set({
              dishes: [...get().dishes.filter((d) => d.placeId !== meal.placeId), ...saved.dishes],
              logs: get().logs.map((l) => (saved.idMap.has(l.dishId) ? { ...l, dishId: saved.idMap.get(l.dishId)! } : l)),
            });
          });
          // Trying a wishlist place takes it off the wishlist.
          if (get().places.some((p) => p.id === meal.placeId && p.wishlist)) get().setWishlist(meal.placeId, false);
        },

        deleteLog: (logId) => {
          set({ logs: get().logs.filter((l) => l.id !== logId) });
          push((r) => r.deleteLog(logId));
        },

        // Sample entries exist only in demo mode.
        clearSamples: () => {
          if (get().userId) return;
          const sampleIds = new Set(get().places.filter((p) => p.sample).map((p) => p.id));
          set({
            places: get().places.filter((p) => !sampleIds.has(p.id)),
            dishes: get().dishes.filter((d) => !sampleIds.has(d.placeId)),
            logs: get().logs.filter((l) => !sampleIds.has(l.placeId)),
            peekPlaceId: null,
          });
        },

        clearAll: () => {
          const userId = get().userId;
          set({ ...EMPTY, peekPlaceId: null });
          if (userId) push((r) => r.deleteEverything());
        },

        loadSamples: () => {
          if (get().userId) return;
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
        setAuthOpen: (authOpen) => set({ authOpen, authLinkFailed: false }),
      };
    },
    {
      name: "hop-gu-diary-v2",
      // Only the demo diary is kept in browser storage. An account's diary is never written there.
      partialize: (s) => ({
        lang: s.lang,
        theme: s.theme,
        demo: s.userId ? (s.demoBackup ?? EMPTY) : { places: s.places, dishes: s.dishes, logs: s.logs },
      }),
      // Saved data that does not pass the shape check is ignored instead of trusted.
      merge: (saved, current) => {
        const parsed = savedSchema.safeParse(saved);
        return parsed.success ? { ...current, lang: parsed.data.lang, theme: parsed.data.theme, ...parsed.data.demo } : current;
      },
    },
  ),
);

/** One-time carry-over of a diary saved by the first prototype. */
if (typeof window !== "undefined") {
  try {
    const old = window.localStorage.getItem("hop-gu-diary-v1");
    if (old && !window.localStorage.getItem("hop-gu-diary-v2")) {
      const parsed = savedSchemaV1.safeParse(JSON.parse(old)?.state);
      if (parsed.success) {
        const { lang, theme, ...demo } = parsed.data;
        useStore.setState({ lang, theme, ...demo });
      }
    }
    window.localStorage.removeItem("hop-gu-diary-v1");
  } catch {
    /* storage unavailable: carry on with defaults */
  }
}

export function exportData(): string {
  const { places, dishes, logs } = useStore.getState();
  return JSON.stringify({ app: "hop-gu", version: 1, exportedAt: new Date().toISOString(), places, dishes, logs }, null, 2);
}
