import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dish, Log, Place } from "./types.ts";
import { dishSchema, logSchema, placeSchema } from "./schemas.ts";
import { normalizeVi } from "./text.ts";

/**
 * Reads and writes the signed-in user's diary in Supabase.
 *
 * Places and dish names are shared between users; logs and the wishlist are
 * private. The database enforces all of that (Row Level Security); this file
 * only translates between the app's objects and database rows.
 */

type Row = Record<string, unknown>;
const PAGE = 1000;
const CHUNK = 100;

export type ReportReason = "duplicate" | "wrong_info" | "closed" | "abuse";

const placeToRow = (p: Place): Row => ({
  id: p.id, name: p.name, area: p.area, address: p.address ?? "", kind: p.kind, lat: p.lat ?? null, lng: p.lng ?? null,
  hours_note: p.hoursNote ?? null, listings: p.listings, visibility: p.visibility ?? "shared",
});
const logToRow = (l: Log): Row => ({
  id: l.id, dish_id: l.dishId, place_id: l.placeId, verdict: l.verdict, chips: l.chips, tags: l.tags,
  note: l.note, platform: l.platform, eaten_on: l.date, created_at: l.createdAt,
});

const rowToPlace = (r: Row, wish?: { note: string }): Place =>
  placeSchema.parse({
    id: r.id, name: r.name, area: r.area, address: r.address || undefined, kind: r.kind,
    lat: r.lat ?? undefined, lng: r.lng ?? undefined, hoursNote: r.hours_note ?? undefined, listings: r.listings,
    visibility: r.visibility, createdBy: r.created_by ?? null,
    wishlist: Boolean(wish), wishNote: wish?.note || undefined, createdAt: r.created_at,
  });
const rowToDish = (r: Row): Dish => dishSchema.parse({ id: r.id, placeId: r.place_id, name: r.name, typeId: r.type_id });
const rowToLog = (r: Row): Log =>
  logSchema.parse({
    id: r.id, dishId: r.dish_id, placeId: r.place_id, verdict: r.verdict, chips: r.chips, tags: r.tags,
    note: r.note, platform: r.platform, date: r.eaten_on, createdAt: r.created_at,
  });

function fail(error: { message: string; code?: string } | null): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

const chunks = <T>(items: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
};

export function createRemote(db: SupabaseClient) {
  async function readAll(table: string, tieBreak: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select("*").order("created_at", { ascending: false }).order(tieBreak).range(from, from + PAGE - 1);
      fail(error);
      rows.push(...(data as Row[]));
      if ((data as Row[]).length < PAGE) return rows;
    }
  }

  async function byIds(table: string, column: string, ids: string[]): Promise<Row[]> {
    const rows: Row[] = [];
    for (const part of chunks(ids)) {
      const { data, error } = await db.from(table).select("*").in(column, part);
      fail(error);
      rows.push(...(data as Row[]));
    }
    return rows;
  }

  async function fetchDishes(placeId: string): Promise<Dish[]> {
    const { data, error } = await db.from("dishes").select("*").eq("place_id", placeId).order("created_at");
    fail(error);
    return (data as Row[]).map(rowToDish);
  }

  return {
    /**
     * Everything in "my diary": my logs and wishlist, and the places (with
     * their dish names) those point at or that I created.
     */
    async fetchAll(userId: string): Promise<{ places: Place[]; dishes: Dish[]; logs: Log[] }> {
      const [logRows, wishRows, mine] = await Promise.all([
        readAll("logs", "id"),
        readAll("wishlist", "place_id"),
        db.from("places").select("*").eq("created_by", userId).order("created_at", { ascending: false }).limit(PAGE),
      ]);
      fail(mine.error);
      const wish = new Map(wishRows.map((w) => [String(w.place_id), { note: String(w.note ?? "") }]));
      const placeRows = new Map((mine.data as Row[]).map((r) => [String(r.id), r]));
      const missing = [...new Set([...logRows.map((l) => String(l.place_id)), ...wish.keys()])].filter((id) => !placeRows.has(id));
      for (const r of await byIds("places", "id", missing)) placeRows.set(String(r.id), r);
      const dishRows = await byIds("dishes", "place_id", [...placeRows.keys()]);
      return {
        places: [...placeRows.values()].map((r) => rowToPlace(r, wish.get(String(r.id)))),
        dishes: dishRows.map(rowToDish),
        logs: logRows.filter((l) => placeRows.has(String(l.place_id))).map(rowToLog),
      };
    },

    /** Shared places whose name, area or address contains every word of the query. */
    async searchPlaces(query: string): Promise<Place[]> {
      const words = normalizeVi(query).split(" ").filter((w) => w.length >= 2).slice(0, 6);
      if (words.length === 0) return [];
      let q = db.from("places").select("*");
      for (const w of words) q = q.ilike("search_text", `%${w}%`);
      const { data, error } = await q.limit(8);
      fail(error);
      return (data as Row[]).map((r) => rowToPlace(r));
    },

    /** Places pinned within roughly 150 m, to catch the same place under another name. */
    async nearbyPlaces(lat: number, lng: number): Promise<Place[]> {
      const d = 0.0014;
      const { data, error } = await db.from("places").select("*").gte("lat", lat - d).lte("lat", lat + d).gte("lng", lng - d).lte("lng", lng + d).limit(8);
      fail(error);
      return (data as Row[]).map((r) => rowToPlace(r));
    },

    fetchDishes,

    async insertPlace(p: Place): Promise<void> {
      fail((await db.from("places").insert(placeToRow(p))).error);
    },

    /** Only the creator's change is accepted; for anyone else this changes nothing. */
    async updatePlace(p: Place): Promise<void> {
      fail((await db.from("places").update(placeToRow(p)).eq("id", p.id)).error);
    },

    async setWishlist(placeId: string, on: boolean, note: string): Promise<void> {
      if (on) fail((await db.from("wishlist").upsert({ place_id: placeId, note }, { onConflict: "user_id,place_id" })).error);
      else fail((await db.from("wishlist").delete().eq("place_id", placeId)).error);
    },

    /**
     * Saves one meal. Dish names are shared, so a "new" dish may already have
     * been added by someone else: the place's dishes are read back and the
     * logs are pointed at whichever entry the database kept.
     * Returns the place's dishes and how temporary dish IDs map to real ones.
     */
    async saveMeal(placeId: string, newDishes: Dish[], logs: Log[]): Promise<{ dishes: Dish[]; idMap: Map<string, string> }> {
      if (newDishes.length) {
        const rows = newDishes.map((d) => ({ id: d.id, place_id: d.placeId, name: d.name, type_id: d.typeId }));
        fail((await db.from("dishes").upsert(rows, { onConflict: "place_id,norm_name", ignoreDuplicates: true })).error);
      }
      const dishes = await fetchDishes(placeId);
      const byName = new Map(dishes.map((d) => [normalizeVi(d.name) || d.name.toLowerCase(), d.id]));
      const idMap = new Map<string, string>();
      for (const d of newDishes) {
        const real = byName.get(normalizeVi(d.name) || d.name.toLowerCase());
        if (real && real !== d.id) idMap.set(d.id, real);
      }
      const rows = logs.map((l) => logToRow({ ...l, dishId: idMap.get(l.dishId) ?? l.dishId }));
      if (rows.length) fail((await db.from("logs").insert(rows)).error);
      return { dishes, idMap };
    },

    /** Fills in a missing dish type. Accepted only from the dish's creator; otherwise nothing changes. */
    async setDishType(dishId: string, typeId: string): Promise<void> {
      fail((await db.from("dishes").update({ type_id: typeId }).eq("id", dishId).is("type_id", null)).error);
    },

    async deleteLog(id: string): Promise<void> {
      fail((await db.from("logs").delete().eq("id", id)).error);
    },

    /**
     * Takes a place out of my diary: my logs and wishlist entry go. The place
     * itself is deleted only if I created it and nobody else uses it; the
     * database refuses otherwise, and that refusal is expected.
     */
    async removeFromDiary(placeId: string): Promise<void> {
      fail((await db.from("logs").delete().eq("place_id", placeId)).error);
      fail((await db.from("wishlist").delete().eq("place_id", placeId)).error);
      const { error } = await db.from("places").delete().eq("id", placeId);
      if (error && error.code !== "23503") fail(error);
    },

    async deleteEverything(): Promise<void> {
      fail((await db.rpc("delete_my_diary")).error);
    },

    async reportPlace(placeId: string, reason: ReportReason): Promise<void> {
      const { error } = await db.from("place_reports").insert({ place_id: placeId, reason });
      // Reporting the same thing twice is fine.
      if (error && error.code !== "23505") fail(error);
    },
  };
}

export type Remote = ReturnType<typeof createRemote>;
