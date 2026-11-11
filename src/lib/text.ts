/**
 * Normalizes Vietnamese text for searching and duplicate detection:
 * "Phở Thìn - Lò Đúc" -> "pho thin lo duc".
 */
export function normalizeVi(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when every word of the query appears in the text (accent-insensitive). */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = normalizeVi(text);
  const words = normalizeVi(query).split(" ").filter(Boolean);
  return words.every((w) => haystack.includes(w));
}

/** "com-tam-ba-ghien" -> "Com Tam Ba Ghien" */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_+\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Straight-line distance in metres between two map points. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
