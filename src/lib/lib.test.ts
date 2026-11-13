import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeVi, matchesQuery, distanceMeters } from "./text.ts";
import { parseShareLink, looksLikeUrl } from "./links.ts";
import { acceptableUrl, decodeEntities, extractTitle, resolveShareLink } from "./linkResolver.ts";
import { guessDishType, DISH_TYPES } from "./dishTypes.ts";
import { computeTaste } from "./taste.ts";
import { summarizePlace } from "./derive.ts";
import type { Dish, Log } from "./types.ts";

test("normalizeVi strips Vietnamese accents", () => {
  assert.equal(normalizeVi("Phở Thìn - Lò Đúc"), "pho thin lo duc");
  assert.equal(normalizeVi("  BÚN BÒ HUẾ đặc biệt!! "), "bun bo hue dac biet");
  assert.ok(matchesQuery("Cơm Tấm Ba Ghiền", "ba ghien com"));
  assert.ok(!matchesQuery("Cơm Tấm Ba Ghiền", "pho"));
});

test("distanceMeters is roughly right", () => {
  const d = distanceMeters({ lat: 10.7769, lng: 106.7009 }, { lat: 10.7859, lng: 106.7009 });
  assert.ok(d > 950 && d < 1050, String(d));
});

test("parseShareLink reads Google Maps place links", () => {
  const p = parseShareLink(
    "https://www.google.com/maps/place/Ph%E1%BB%9F+H%C3%B2a+Pasteur/@10.7868,106.6893,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d10.7870123!4d106.6891456",
  );
  assert.equal(p?.platform, "gmaps");
  assert.equal(p?.name, "Phở Hòa Pasteur");
  assert.equal(p?.lat, 10.7870123);
  assert.equal(p?.lng, 106.6891456);
  assert.equal(p?.short, false);
});

test("parseShareLink reads Grab and ShopeeFood links", () => {
  const g = parseShareLink("https://food.grab.com/vn/en/restaurant/com-tam-ba-ghien-delivery/5-ABC123?utm=x");
  assert.equal(g?.platform, "grab");
  assert.equal(g?.name, "Com Tam Ba Ghien");
  const s = parseShareLink("https://shopeefood.vn/ho-chi-minh/bun-bo-o-xuan");
  assert.equal(s?.platform, "shopeefood");
  assert.equal(s?.name, "Bun Bo O Xuan");
});

test("parseShareLink handles the links the ShopeeFood app really copies", () => {
  const short = parseShareLink("https://shopeefood.vn/u/Ni5oTmf");
  assert.deepEqual([short?.platform, short?.name, short?.short, short?.resolvable, short?.url], ["shopeefood", undefined, true, true, "https://shopeefood.vn/u/Ni5oTmf"]);
  // The long form carries only a number: it must not become the place name, and tracking is dropped.
  const full = parseShareLink("https://shopeefood.vn/now-food/shop/1263913?shareChannel=copy_link&stm_medium=referral&stm_source=rw&uls_trackid=5743lmvn01lu");
  assert.deepEqual([full?.name, full?.short, full?.resolvable, full?.url], [undefined, true, undefined, "https://shopeefood.vn/now-food/shop/1263913"]);
});

test("link resolver only opens ShopeeFood short links", () => {
  assert.equal(acceptableUrl("https://shopeefood.vn/u/Ni5oTmf?x=1#y"), "https://shopeefood.vn/u/Ni5oTmf");
  for (const bad of [
    "http://shopeefood.vn/u/Ni5oTmf", "https://shopeefood.vn/now-food/shop/1", "https://shopeefood.vn/u/../admin", "https://shopeefood.vn/u/a%2Fb",
    "https://shopeefood.vn.evil.io/u/Ni5oTmf", "https://evil.io/u/Ni5oTmf", "https://shopeefood.vn:8443/u/Ni5oTmf", "https://a:b@shopeefood.vn/u/Ni5oTmf",
    "https://127.0.0.1/u/Ni5oTmf", "https://169.254.169.254/u/abcd", "file:///etc/passwd", "not a url",
  ]) assert.equal(acceptableUrl(bad), null, bad);
});

test("link resolver reads and cleans the page title", async () => {
  const page = '<html><head><title>x</title><meta property="og:title" content="Nui X&agrave;o B&#242;, M&#xEC; &amp; C&#417;m &lt;b&gt;L&uacute;c"></head></html>';
  assert.equal(extractTitle(page), "Nui X&agrave;o Bò, Mì & Cơm b L&uacute;c");
  assert.equal(extractTitle("<title>  Quán   Cô Ba\n</title>"), "Quán Cô Ba");
  assert.equal(extractTitle("<p>nothing</p>"), null);
  assert.equal(decodeEntities("A &amp; B &#39;c&#x27; &bogus;"), "A & B 'c' &bogus;");

  const calls: string[] = [];
  const ok = await resolveShareLink("https://shopeefood.vn/u/Abcd1", async (url) => {
    calls.push(url);
    return new Response('<meta property="og:title" content="Quán Thử">', { status: 200 });
  });
  assert.deepEqual([ok, calls], [{ ok: true, name: "Quán Thử" }, ["https://shopeefood.vn/u/Abcd1"]]);

  // A redirect to another site is never followed.
  const hops: string[] = [];
  const away = await resolveShareLink("https://shopeefood.vn/u/Abcd1", async (url) => {
    hops.push(url);
    return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
  });
  assert.deepEqual([away, hops.length], [{ ok: false, reason: "no_name" }, 1]);

  // Redirect loops stop after a few hops.
  let n = 0;
  const loop = await resolveShareLink("https://shopeefood.vn/u/Abcd1", async () => {
    n++;
    return new Response(null, { status: 302, headers: { location: "/u/Abcd2" } });
  });
  assert.deepEqual([loop.ok, n], [false, 3]);

  // Only the first 64 KB of a reply is read.
  const huge = await resolveShareLink("https://shopeefood.vn/u/Abcd1", async () => new Response("x".repeat(200_000) + '<meta property="og:title" content="late">', { status: 200 }));
  assert.deepEqual(huge, { ok: false, reason: "no_name" });

  assert.deepEqual(await resolveShareLink("https://evil.io/u/Abcd1", async () => { throw new Error("must not be called"); }), { ok: false, reason: "unsupported" });
  assert.deepEqual(await resolveShareLink("https://shopeefood.vn/u/Abcd1", async () => { throw new Error("network down"); }), { ok: false, reason: "unreachable" });
});

test("parseShareLink flags short links and rejects unknown or unsafe ones", () => {
  assert.equal(parseShareLink("https://maps.app.goo.gl/abc123")?.short, true);
  assert.equal(parseShareLink("https://r.grab.com/g/abc")?.short, true);
  assert.equal(parseShareLink("https://evil.example.com/maps/place/X"), null);
  assert.equal(parseShareLink("https://google.com.evil.io/maps/place/X"), null);
  assert.equal(parseShareLink("javascript:alert(1)"), null);
  assert.equal(parseShareLink("https://user:pw@food.grab.com/vn/en/restaurant/x/1"), null);
  assert.equal(parseShareLink("not a link"), null);
  assert.ok(looksLikeUrl(" https://food.grab.com/x "));
  assert.ok(!looksLikeUrl("bun bo"));
});

test("stored link is rebuilt as https on the recognised host", () => {
  const p = parseShareLink("http://food.grab.com/vn/vi/restaurant/abc-delivery/1#frag");
  assert.equal(p?.url, "https://food.grab.com/vn/vi/restaurant/abc-delivery/1");
});

test("guessDishType picks the most specific type", () => {
  assert.equal(guessDishType("Bún bò Huế đặc biệt"), "bbh");
  assert.equal(guessDishType("Cơm tấm sườn bì chả"), "comtam");
  assert.equal(guessDishType("Trà sữa trân châu"), "trasua");
  assert.equal(guessDishType("Mì Ý sốt bò"), null);
  assert.equal(new Set(DISH_TYPES.map((t) => t.id)).size, DISH_TYPES.length);
});

const dish = (id: string, placeId: string, typeId: string | null): Dish => ({ id, placeId, name: id, typeId });
const log = (id: string, dishId: string, placeId: string, verdict: Log["verdict"], chips: Log["chips"] = {}): Log => ({
  id, dishId, placeId, verdict, chips, tags: [], note: "", platform: "grab", date: "2026-11-0" + id.slice(-1), createdAt: id,
});

test("computeTaste: loving low-sweet and rejecting sweet means a low-sweet lean", () => {
  const dishes = [dish("a", "p1", "bbh"), dish("b", "p2", "bbh")];
  const logs = [log("l1", "a", "p1", "love", { sweet: -1, broth: 1 }), log("l2", "b", "p2", "never", { sweet: 1 })];
  const [t] = computeTaste(logs, dishes);
  assert.equal(t.typeId, "bbh");
  assert.equal(t.descriptors.sweet.lean, "low");
  assert.equal(t.descriptors.broth.lean, "high");
});

test("computeTaste: loving both ends of a chip means it does not matter", () => {
  const dishes = [dish("a", "p1", "bbh"), dish("b", "p2", "bbh")];
  const logs = [log("l1", "a", "p1", "love", { sweet: -1 }), log("l2", "b", "p2", "love", { sweet: 1 })];
  const [t] = computeTaste(logs, dishes);
  assert.equal(t.descriptors.sweet.lean, "any");
});

test("computeTaste: a later log without chips still counts, using the dish's known chips", () => {
  const dishes = [dish("a", "p1", "pho")];
  const logs = [log("l1", "a", "p1", "love", { broth: 1 }), log("l2", "a", "p1", "love")];
  const [t] = computeTaste(logs, dishes);
  assert.equal(t.descriptors.broth.n, 2);
});

test("summarizePlace uses the latest verdict per dish", () => {
  const dishes = [dish("a", "p1", "bbh"), dish("b", "p1", null)];
  const logs = [log("l1", "a", "p1", "never"), log("l2", "a", "p1", "love"), log("l3", "b", "p1", "never")];
  const s = summarizePlace("p1", dishes, logs);
  assert.deepEqual([s.love, s.ok, s.never, s.status], [1, 0, 1, "love"]);
  assert.equal(summarizePlace("p2", dishes, logs).status, null);
});
