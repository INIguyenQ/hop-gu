import type { Dish, Log, Place } from "./types.ts";

/**
 * Invented sample entries so a first-time visitor sees how the diary works.
 * The names are made up; they are not reviews of real businesses.
 */
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export function buildSampleData(): { places: Place[]; dishes: Dish[]; logs: Log[] } {
  const now = new Date().toISOString();
  const place = (id: string, name: string, area: string, lat: number, lng: number, extra: Partial<Place> = {}): Place => ({
    id, name, area, kind: "shop", lat, lng, listings: [], wishlist: false, sample: true, createdAt: now, ...extra,
  });
  const places: Place[] = [
    place("s-p1", "Bún Bò Cô Sáu", "Quận 3", 10.7829, 106.6866),
    place("s-p2", "Bún Bò Ngọt Ngào", "Quận 10", 10.7721, 106.6689),
    place("s-p3", "Cơm Tấm Hẻm 42", "Bình Thạnh", 10.8012, 106.7103),
    place("s-p4", "Phở Bắc Ông Tư", "Quận 1", 10.7745, 106.6994),
    place("s-p5", "Xe bánh mì đầu hẻm", "Phú Nhuận", 10.7993, 106.6802, { kind: "street", hoursNote: "Chỉ bán sáng, 6–9 giờ" }),
    place("s-p6", "Trà Sữa Mây", "Quận 1", 10.7701, 106.6921),
    place("s-p7", "Ốc Đêm Bà Năm", "Quận 4", 10.7592, 106.7037, { wishlist: true, wishNote: "Bạn rủ đi thử ốc len xào dừa" }),
  ];
  const dishes: Dish[] = [
    { id: "s-d1", placeId: "s-p1", name: "Bún bò đặc biệt", typeId: "bbh" },
    { id: "s-d2", placeId: "s-p1", name: "Chả cua", typeId: null },
    { id: "s-d3", placeId: "s-p2", name: "Bún bò giò heo", typeId: "bbh" },
    { id: "s-d4", placeId: "s-p3", name: "Cơm tấm sườn bì chả", typeId: "comtam" },
    { id: "s-d5", placeId: "s-p4", name: "Phở tái nạm", typeId: "pho" },
    { id: "s-d6", placeId: "s-p5", name: "Bánh mì thịt nguội", typeId: "banhmi" },
    { id: "s-d7", placeId: "s-p6", name: "Trà sữa trân châu đường đen", typeId: "trasua" },
    { id: "s-d8", placeId: "s-p6", name: "Trà đào", typeId: null },
  ];
  const log = (n: number, dishId: string, verdict: Log["verdict"], days: number, platform: Log["platform"], chips: Log["chips"], tags: string[] = [], note = ""): Log => ({
    id: `s-l${n}`, dishId, placeId: dishes.find((x) => x.id === dishId)!.placeId, verdict, chips, tags, note, platform,
    date: daysAgo(days), createdAt: new Date(Date.now() - days * 864e5 - n).toISOString(),
  });
  const logs: Log[] = [
    log(1, "s-d1", "love", 2, "dinein", { sweet: -1, broth: 1, style: 1, spice: 1 }, ["value"], "Nước dùng đậm, thơm mắm ruốc, đúng kiểu Huế."),
    log(2, "s-d2", "ok", 2, "dinein", {}, [], "Hơi khô."),
    log(3, "s-d3", "never", 9, "grab", { sweet: 1, broth: 0, style: -1 }, [], "Quá ngọt so với khẩu vị của mình."),
    log(4, "s-d4", "love", 5, "shopeefood", { sweet: 0, char: 1, rice: 0 }, ["value"], "Sườn nướng cháy cạnh, nước mắm vừa."),
    log(5, "s-d5", "ok", 14, "dinein", { broth: -1, sweet: -1, style: -1 }, [], "Thanh nhưng hơi nhạt."),
    log(6, "s-d6", "love", 1, "dinein", { crisp: 1, rich: 1, filling: 1 }, [], "Vỏ giòn, pa-tê béo."),
    log(7, "s-d7", "never", 20, "befood", { sweet: 1, strength: -1, chew: 0 }, ["late", "pricey"], "Ngọt gắt, giao trễ 40 phút."),
    log(8, "s-d8", "ok", 20, "befood", {}, []),
    log(9, "s-d1", "love", 30, "grab", {}, [], "Đặt giao về vẫn ngon."),
  ];
  return { places, dishes, logs };
}
