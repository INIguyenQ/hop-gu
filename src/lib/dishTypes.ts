import type { L } from "./types.ts";
import { normalizeVi } from "./text.ts";

/** One taste dimension, rated on a 3-step scale (low / medium / high). */
export interface Descriptor {
  id: string;
  label: L;
  scale: [L, L, L];
}

export interface DishType {
  id: string;
  name: L;
  aliases: string[];
  descriptors: Descriptor[];
}

const d = (id: string, vi: string, en: string, viScale: string, enScale: string): Descriptor => {
  const v = viScale.split("|");
  const e = enScale.split("|");
  return {
    id,
    label: { vi, en },
    scale: [
      { vi: v[0], en: e[0] },
      { vi: v[1], en: e[1] },
      { vi: v[2], en: e[2] },
    ],
  };
};

const LIB = {
  sweet: d("sweet", "Độ ngọt", "Sweetness", "Ít ngọt|Vừa|Ngọt nhiều", "Low|Medium|High"),
  salty: d("salty", "Độ mặn", "Saltiness", "Nhạt|Vừa|Mặn", "Low|Medium|High"),
  sour: d("sour", "Độ chua", "Sourness", "Ít chua|Vừa|Chua nhiều", "Low|Medium|High"),
  spice: d("spice", "Độ cay", "Spice", "Nhẹ|Vừa|Cay", "Mild|Medium|Hot"),
  broth: d("broth", "Nước dùng", "Broth", "Thanh|Vừa|Đậm đà", "Light|Medium|Rich"),
  rich: d("rich", "Độ béo", "Richness", "Ít béo|Vừa|Béo", "Light|Medium|Rich"),
  greasy: d("greasy", "Dầu mỡ", "Greasiness", "Ít dầu|Vừa|Nhiều dầu", "Low|Medium|High"),
  char: d("char", "Nướng cháy cạnh", "Grill char", "Ít|Vừa|Cháy thơm", "Light|Medium|Heavy"),
  crisp: d("crisp", "Độ giòn", "Crispiness", "Mềm|Vừa|Giòn rụm", "Soft|Medium|Very crisp"),
  filling: d("filling", "Lượng nhân", "Filling", "Ít|Vừa|Đầy đặn", "Little|Medium|Generous"),
  topping: d("topping", "Topping", "Toppings", "Ít|Vừa|Nhiều", "Few|Medium|Plenty"),
  meat: d("meat", "Lượng thịt", "Meat amount", "Ít|Vừa|Nhiều", "Little|Medium|Plenty"),
  portion: d("portion", "Khẩu phần", "Portion", "Nhỏ|Vừa|Lớn", "Small|Medium|Large"),
  mam: d("mam", "Mùi mắm", "Fermented flavour", "Nhẹ|Vừa|Nồng", "Light|Medium|Strong"),
  fresh: d("fresh", "Độ tươi", "Freshness", "Kém tươi|Ổn|Rất tươi", "Low|Fine|Very fresh"),
  thick: d("thick", "Độ sánh", "Thickness", "Loãng|Vừa|Đặc", "Thin|Medium|Thick"),
  strength: d("strength", "Độ đậm", "Strength", "Nhạt|Vừa|Đậm", "Weak|Medium|Strong"),
  tender: d("tender", "Độ mềm thịt", "Tenderness", "Dai|Vừa|Mềm", "Chewy|Medium|Tender"),
  chew: d("chew", "Độ dai topping", "Topping chewiness", "Mềm|Vừa|Dai", "Soft|Medium|Chewy"),
  rice: d("rice", "Cơm", "Rice texture", "Mềm|Vừa|Khô tơi", "Soft|Medium|Dry"),
};

const style = (viLow: string, viHigh: string, enLow: string, enHigh: string) =>
  d("style", "Kiểu nấu", "Style", `${viLow}|Pha trộn|${viHigh}`, `${enLow}|Mixed|${enHigh}`);

const t = (id: string, vi: string, en: string, aliases: string[], descriptors: Descriptor[]): DishType => ({
  id,
  name: { vi, en },
  aliases,
  descriptors,
});

/** Used for dishes that do not belong to any listed dish type. */
export const GENERIC_DESCRIPTORS: Descriptor[] = [LIB.sweet, LIB.salty, LIB.spice, LIB.portion];

/**
 * First draft of the top HCMC dish types (see the plan's appendix).
 * The descriptor choices are meant to be corrected by someone who knows the food.
 */
export const DISH_TYPES: DishType[] = [
  t("pho", "Phở bò", "Beef phở", ["pho", "pho bo", "pho tai"], [LIB.broth, LIB.sweet, style("Kiểu Bắc", "Kiểu Nam", "Northern", "Southern"), LIB.meat]),
  t("bbh", "Bún bò Huế", "Bún bò Huế", ["bun bo", "bbh", "bun bo hue"], [LIB.sweet, LIB.broth, style("Kiểu Sài Gòn", "Chuẩn Huế", "Saigon", "Huế-authentic"), LIB.spice]),
  t("comtam", "Cơm tấm", "Broken rice", ["com tam", "com suon"], [LIB.sweet, LIB.char, LIB.rice]),
  t("banhmi", "Bánh mì", "Bánh mì", ["banh mi"], [LIB.crisp, LIB.rich, LIB.filling, LIB.sweet]),
  t("hutieu", "Hủ tiếu", "Hủ tiếu", ["hu tieu", "hu tiu", "nam vang"], [LIB.sweet, LIB.broth, LIB.topping]),
  t("bunrieu", "Bún riêu", "Crab noodle soup", ["bun rieu"], [LIB.sour, LIB.broth, LIB.mam]),
  t("bunthitnuong", "Bún thịt nướng", "Grilled pork noodles", ["bun thit nuong"], [LIB.sweet, LIB.char, LIB.fresh]),
  t("buncha", "Bún chả", "Bún chả", ["bun cha"], [LIB.sour, LIB.char, style("Kiểu Sài Gòn", "Chuẩn Hà Nội", "Saigon", "Hanoi-authentic")]),
  t("banhxeo", "Bánh xèo", "Sizzling crêpe", ["banh xeo"], [LIB.crisp, LIB.filling, LIB.sweet]),
  t("goicuon", "Gỏi cuốn", "Fresh spring rolls", ["goi cuon"], [LIB.fresh, LIB.filling, LIB.rich]),
  t("banhcuon", "Bánh cuốn", "Steamed rice rolls", ["banh cuon"], [LIB.filling, LIB.sweet]),
  t("bunmam", "Bún mắm", "Fermented fish noodles", ["bun mam"], [LIB.mam, LIB.sweet, LIB.topping]),
  t("lau", "Lẩu", "Hotpot", ["lau"], [LIB.sour, LIB.spice, LIB.broth]),
  t("oc", "Ốc", "Snails & shellfish", ["oc"], [LIB.rich, LIB.spice, LIB.fresh]),
  t("bokho", "Bò kho", "Beef stew", ["bo kho"], [LIB.thick, LIB.sweet, LIB.tender]),
  t("chaolong", "Cháo lòng", "Offal porridge", ["chao long", "chao"], [LIB.thick, LIB.salty, LIB.fresh]),
  t("xoi", "Xôi", "Sticky rice", ["xoi"], [LIB.sweet, LIB.topping, LIB.portion]),
  t("comga", "Cơm gà", "Chicken rice", ["com ga"], [LIB.tender, LIB.spice, LIB.rich]),
  t("bundau", "Bún đậu mắm tôm", "Tofu noodles with shrimp paste", ["bun dau"], [LIB.mam, LIB.crisp, LIB.portion]),
  t("phalau", "Phá lấu", "Braised offal", ["pha lau"], [LIB.rich, LIB.sweet, LIB.tender]),
  t("banhtrangtron", "Bánh tráng trộn", "Rice paper salad", ["banh trang"], [LIB.sour, LIB.spice, LIB.topping]),
  t("botchien", "Bột chiên", "Fried rice cake", ["bot chien"], [LIB.crisp, LIB.greasy, LIB.sweet]),
  t("miquang", "Mì Quảng", "Mì Quảng", ["mi quang"], [LIB.broth, style("Kiểu Sài Gòn", "Chuẩn Quảng", "Saigon", "Quảng-authentic")]),
  t("banhcanh", "Bánh canh", "Thick noodle soup", ["banh canh"], [LIB.thick, LIB.topping, LIB.sweet]),
  t("bunca", "Bún cá", "Fish noodle soup", ["bun ca"], [LIB.sour, LIB.broth, LIB.fresh]),
  t("garan", "Gà rán", "Fried chicken", ["ga ran", "ga chien"], [LIB.crisp, LIB.greasy, LIB.salty]),
  t("che", "Chè", "Sweet soup", ["che"], [LIB.sweet, LIB.rich, LIB.topping]),
  t("caphe", "Cà phê", "Coffee", ["ca phe", "cafe", "coffee", "bac xiu"], [LIB.strength, LIB.sweet, style("Pha phin", "Pha máy", "Phin", "Espresso")]),
  t("trasua", "Trà sữa", "Milk tea", ["tra sua", "milk tea"], [LIB.sweet, LIB.strength, LIB.chew]),
  t("sinhto", "Sinh tố / nước ép", "Smoothie / juice", ["sinh to", "nuoc ep"], [LIB.sweet, LIB.fresh, LIB.thick]),
];

const BY_ID = new Map(DISH_TYPES.map((x) => [x.id, x]));

export function getDishType(id: string | null | undefined): DishType | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function descriptorsFor(typeId: string | null | undefined): Descriptor[] {
  return getDishType(typeId)?.descriptors ?? GENERIC_DESCRIPTORS;
}

/** Guesses the dish type from a dish name: "Bún bò đặc biệt" -> bbh. Longest alias wins. */
export function guessDishType(dishName: string): string | null {
  const name = ` ${normalizeVi(dishName)} `;
  let best: { id: string; len: number } | null = null;
  for (const type of DISH_TYPES) {
    for (const alias of [normalizeVi(type.name.vi), ...type.aliases]) {
      if (name.includes(` ${alias} `) && (!best || alias.length > best.len)) {
        best = { id: type.id, len: alias.length };
      }
    }
  }
  return best?.id ?? null;
}
