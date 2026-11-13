export type Verdict = "love" | "ok" | "never";
export type Platform = "grab" | "shopeefood" | "befood" | "gmaps" | "dinein" | "other";
export type ChipValue = -1 | 0 | 1;
export type Lang = "vi" | "en";
export type Theme = "system" | "light" | "dark";

/** A piece of text in both app languages. */
export interface L {
  vi: string;
  en: string;
}

export interface Listing {
  platform: Platform;
  url: string;
}

/** One real location: a restaurant, a branch or a street cart. */
export interface Place {
  id: string;
  name: string;
  area: string;
  /** Street address, as the user typed it. */
  address?: string;
  kind: "shop" | "street";
  /** "shared": other signed-in users can find it. "private": only its creator. */
  visibility?: "shared" | "private";
  /** The account that added it; null once that account has left. */
  createdBy?: string | null;
  lat?: number;
  lng?: number;
  hoursNote?: string;
  listings: Listing[];
  wishlist: boolean;
  wishNote?: string;
  sample?: boolean;
  createdAt: string;
}

/** A specific item at a specific place ("Bún bò đặc biệt at O Xuân"). */
export interface Dish {
  id: string;
  placeId: string;
  name: string;
  typeId: string | null;
}

/** One time the user ate one dish. */
export interface Log {
  id: string;
  dishId: string;
  placeId: string;
  verdict: Verdict;
  chips: Record<string, ChipValue>;
  tags: string[];
  note: string;
  platform: Platform;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export const VERDICTS: Verdict[] = ["love", "ok", "never"];
export const PLATFORMS: Platform[] = ["grab", "shopeefood", "befood", "dinein", "other"];
