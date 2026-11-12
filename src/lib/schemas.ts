import { z } from "zod";

/** Shape checks for anything that comes from outside the app: browser storage or the database. */
const str = (max: number) => z.string().max(max);
const platform = z.enum(["grab", "shopeefood", "befood", "gmaps", "dinein", "other"]);

export const listingSchema = z.object({ platform, url: str(2000).regex(/^https:\/\//) });

export const placeSchema = z.object({
  id: str(64), name: str(120), area: str(80), kind: z.enum(["shop", "street"]),
  lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
  hoursNote: str(120).optional(), listings: z.array(listingSchema).max(10),
  wishlist: z.boolean(), wishNote: str(300).optional(), sample: z.boolean().optional(), createdAt: str(40),
});

export const dishSchema = z.object({ id: str(64), placeId: str(64), name: str(120), typeId: str(40).nullable() });

export const logSchema = z.object({
  id: str(64), dishId: str(64), placeId: str(64), verdict: z.enum(["love", "ok", "never"]),
  chips: z.record(str(40), z.union([z.literal(-1), z.literal(0), z.literal(1)])),
  tags: z.array(str(40)).max(12), note: str(1000), platform,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), createdAt: str(40),
});

export const dataSchema = z.object({
  places: z.array(placeSchema).max(20000),
  dishes: z.array(dishSchema).max(100000),
  logs: z.array(logSchema).max(200000),
});
