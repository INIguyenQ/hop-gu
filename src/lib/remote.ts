import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dish, Log, Place } from "./types.ts";
import { dishSchema, logSchema, placeSchema } from "./schemas.ts";

/**
 * Reads and writes the signed-in user's diary in Supabase.
 * The database decides whose rows these are (Row Level Security); this file
 * only translates between the app's objects and database rows.
 */

type Row = Record<string, unknown>;
const PAGE = 1000;

const placeToRow = (p: Place): Row => ({
  id: p.id, name: p.name, area: p.area, kind: p.kind, lat: p.lat ?? null, lng: p.lng ?? null,
  hours_note: p.hoursNote ?? null, listings: p.listings, wishlist: p.wishlist, wish_note: p.wishNote ?? null, created_at: p.createdAt,
});
const dishToRow = (d: Dish): Row => ({ id: d.id, place_id: d.placeId, name: d.name, type_id: d.typeId });
const logToRow = (l: Log): Row => ({
  id: l.id, dish_id: l.dishId, place_id: l.placeId, verdict: l.verdict, chips: l.chips, tags: l.tags,
  note: l.note, platform: l.platform, eaten_on: l.date, created_at: l.createdAt,
});

const rowToPlace = (r: Row): Place =>
  placeSchema.parse({
    id: r.id, name: r.name, area: r.area, kind: r.kind, lat: r.lat ?? undefined, lng: r.lng ?? undefined,
    hoursNote: r.hours_note ?? undefined, listings: r.listings, wishlist: r.wishlist, wishNote: r.wish_note ?? undefined, createdAt: r.created_at,
  });
const rowToDish = (r: Row): Dish => dishSchema.parse({ id: r.id, placeId: r.place_id, name: r.name, typeId: r.type_id });
const rowToLog = (r: Row): Log =>
  logSchema.parse({
    id: r.id, dishId: r.dish_id, placeId: r.place_id, verdict: r.verdict, chips: r.chips, tags: r.tags,
    note: r.note, platform: r.platform, date: r.eaten_on, createdAt: r.created_at,
  });

async function readAll(db: SupabaseClient, table: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").order("created_at", { ascending: false }).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

async function check(request: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await request;
  if (error) throw new Error(error.message);
}

export function createRemote(db: SupabaseClient) {
  return {
    async fetchAll(): Promise<{ places: Place[]; dishes: Dish[]; logs: Log[] }> {
      const [places, dishes, logs] = await Promise.all([readAll(db, "places"), readAll(db, "dishes"), readAll(db, "logs")]);
      return { places: places.map(rowToPlace), dishes: dishes.map(rowToDish), logs: logs.map(rowToLog) };
    },
    insertPlace: (p: Place) => check(db.from("places").insert(placeToRow(p))),
    updatePlace: (p: Place) => check(db.from("places").update(placeToRow(p)).eq("id", p.id)),
    deletePlace: (id: string) => check(db.from("places").delete().eq("id", id)),
    /** Saves one meal: new dishes first, then changed dishes, then the logs that point at them. */
    async saveMeal(newDishes: Dish[], changedDishes: Dish[], logs: Log[]): Promise<void> {
      if (newDishes.length) await check(db.from("dishes").insert(newDishes.map(dishToRow)));
      for (const d of changedDishes) await check(db.from("dishes").update({ type_id: d.typeId }).eq("id", d.id));
      if (logs.length) await check(db.from("logs").insert(logs.map(logToRow)));
    },
    deleteLog: (id: string) => check(db.from("logs").delete().eq("id", id)),
    /** Removes every place the user owns; their dishes and logs go with them. */
    deleteEverything: (userId: string) => check(db.from("places").delete().eq("user_id", userId)),
  };
}

export type Remote = ReturnType<typeof createRemote>;
