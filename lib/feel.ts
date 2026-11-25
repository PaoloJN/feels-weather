import type { Hour } from "./weather";

/* ---------- Feel bands: what the air feels like on a body ---------- */

export type Theme = {
  bg: string;
  ink: string;
  outer: string;
  top: string;
  bottom: string;
  accent: string;
};

type Band = { id: string; max: number; word: string; theme: Theme };

const LIGHT = "#F4F3FF";
const DARK = "#17130A";

export const BANDS: Band[] = [
  { id: "bitter", max: -6, word: "Bitter", theme: { bg: "#1B2559", ink: LIGHT, outer: "#F2B84B", top: "#E4E8FF", bottom: "#0D1232", accent: "#E8553F" } },
  { id: "freezing", max: 2, word: "Freezing", theme: { bg: "#2B4C9B", ink: LIGHT, outer: "#F4CF6A", top: "#E4ECFF", bottom: "#111E44", accent: "#E8553F" } },
  { id: "cold", max: 8, word: "Cold", theme: { bg: "#2A7391", ink: "#F1FAFC", outer: "#F3DDA6", top: "#C8473A", bottom: "#102C38", accent: "#F2B84B" } },
  { id: "chilly", max: 13, word: "Chilly", theme: { bg: "#6FA89B", ink: "#0C2621", outer: "#173F38", top: "#F6F1DF", bottom: "#2B2F3F", accent: "#E8553F" } },
  { id: "cool", max: 18, word: "Cool", theme: { bg: "#B5C672", ink: "#1C280C", outer: "#2B4A6B", top: "#2F4A1C", bottom: "#3A3526", accent: "#E8553F" } },
  { id: "comfortable", max: 24, word: "Comfortable", theme: { bg: "#EDCB57", ink: DARK, outer: "#2B4A6B", top: "#C2452D", bottom: "#2F3A5F", accent: "#2F3A5F" } },
  { id: "warm", max: 29, word: "Warm", theme: { bg: "#F0974B", ink: "#2E1303", outer: "#2B4A6B", top: "#FFF6E0", bottom: "#7A2E12", accent: "#2B4A6B" } },
  { id: "hot", max: 35, word: "Hot", theme: { bg: "#E5533D", ink: "#FFF4EC", outer: "#2B4A6B", top: "#FFE9A8", bottom: "#5B1410", accent: "#FFF4EC" } },
  { id: "scorching", max: Infinity, word: "Scorching", theme: { bg: "#B8232B", ink: "#FFF1E6", outer: "#2B4A6B", top: "#FFD36B", bottom: "#470B11", accent: "#FFF1E6" } },
];

/** bias: -2 (I run cold) … +2 (I run hot). Each step shifts the feel by 2°C. */
export const feelOf = (h: Hour, bias: number) => h.feels + bias * 2;

export const bandIndex = (feel: number) => BANDS.findIndex((b) => feel < b.max);

export function themeFor(feel: number, night: boolean): Theme {
  const t = BANDS[bandIndex(feel)].theme;
  if (!night) return t;
  return { ...t, bg: `color-mix(in oklab, ${t.bg} 42%, #0A0E26)`, ink: LIGHT };
}

/* ---------- Conditions ---------- */

export function conditions(h: Hour, bias: number) {
  const feel = feelOf(h, bias);
  const snowy = h.snow > 0 || (h.code >= 71 && h.code <= 77) || h.code === 85 || h.code === 86;
  return {
    feel,
    snowy,
    wet: !snowy && (h.pop >= 50 || h.precip >= 0.3),
    stormy: h.code >= 95,
    windy: h.wind >= 30 || h.gust >= 45,
    sunny: h.isDay && h.cloud <= 35,
    grey: h.cloud >= 80,
    muggy: feel >= 24 && h.rh >= 70,
    uvHigh: h.uv >= 6,
    foggy: h.code === 45 || h.code === 48,
  };
}

/** One short sentence for how it feels to stand outside. */
export function headline(h: Hour, bias: number): string {
  const c = conditions(h, bias);
  const i = bandIndex(c.feel);
  const w = BANDS[i].word;
  if (c.stormy) return `${w} and stormy.`;
  if (c.snowy) return `${w} and snowing.`;
  if (c.wet) return c.windy ? `${w}, wet and blowing.` : `${w} and wet.`;
  if (c.muggy) return `${w} and sticky.`;
  if (c.windy) return i <= 4 ? `${w}, with a bite in the wind.` : `${w} and breezy.`;
  if (c.foggy) return `${w} and foggy.`;
  if (c.sunny) {
    if (i === 4) return "Crisp and bright.";
    return i <= 3 ? `${w} but bright.` : `${w} and sunny.`;
  }
  if (!h.isDay && h.cloud <= 35) return `${w} and clear.`;
  if (c.grey) return `${w} and grey.`;
  return `${w}.`;
}

/* ---------- Outfit: built from the clothes actually worn ---------- */

/**
 * The wardrobe. Everything the app says to wear comes from here, so edit these
 * words to match what's in the closet. Tops stack: each level adds one layer.
 */
export const WARDROBE = {
  base: "Thin long-sleeve shirt",
  mid: "Hoodie",
  over: "Quarter-zip",
  pants: "Jeans",
  warmPants: "Sweatpants",
};

export type Outfit = {
  level: 1 | 2 | 3 | 4; // how many layers deep
  outer: "none" | "shell" | "jacket" | "coat" | "parka" | "quarterzip";
  top: "tank" | "tee" | "long" | "sweater" | "hoodie";
  bottom: "shorts" | "pants";
  sweats: boolean;
  boots: boolean;
  beanie: boolean;
  scarf: boolean;
  gloves: boolean;
  sunglasses: boolean;
  cap: boolean;
  umbrella: boolean;
  wear: string[];
  carry: string[];
};

export function outfitFor(h: Hour, bias: number): Outfit {
  const c = conditions(h, bias);
  const i = bandIndex(c.feel);
  const W = WARDROBE;
  const o: Outfit = {
    level: 1, outer: "none", top: "long", bottom: "pants", sweats: false,
    boots: false, beanie: false, scarf: false, gloves: false,
    sunglasses: false, cap: false, umbrella: false, wear: [], carry: [],
  };
  const precip = c.wet || c.snowy || c.stormy;

  if (i <= 1) {
    // freezing and below: everything, and the warmer pants
    Object.assign(o, { level: 4, top: "hoodie", outer: "quarterzip", sweats: !precip, beanie: true, gloves: true });
    o.wear = [`${W.base}, ${W.mid.toLowerCase()} and ${W.over.toLowerCase()}, all three`, precip ? W.pants : W.warmPants, "Hat and gloves"];
  } else if (i <= 3) {
    // cold and chilly: both layers over the shirt
    Object.assign(o, { level: 3, top: "hoodie", outer: "quarterzip", sweats: i === 2 && !precip, beanie: i === 2 && c.windy });
    o.wear = [`${W.mid} with the ${W.over.toLowerCase()} over it`, `${W.base} underneath`, o.sweats ? W.warmPants : W.pants];
    if (o.beanie) o.wear.push("Something over your ears");
  } else if (i === 4) {
    Object.assign(o, { level: 2, top: "hoodie", outer: c.windy ? "quarterzip" : "none" });
    o.wear = [`${W.mid} over the ${W.base.toLowerCase()}`, W.pants];
    if (c.windy) {
      o.level = 3;
      o.wear[0] = `${W.mid} with the ${W.over.toLowerCase()} over it, for the wind`;
    }
  } else {
    o.wear = [i >= 7 ? `${W.base}, sleeves pushed up` : `Just the ${W.base.toLowerCase()}`, W.pants];
    if (i >= 7) o.carry.push("Water");
  }

  if (c.wet || c.stormy) {
    if (c.windy || c.stormy) o.wear.push("Hood up. An umbrella won't survive this");
    else {
      o.umbrella = true;
      o.carry.push("Umbrella, since hoodies soak through");
    }
  }
  if (c.snowy) o.wear.push("Shoes that can get wet");
  if (c.sunny && h.isDay) {
    o.sunglasses = true;
    o.carry.push("Sunglasses");
  }
  if (c.uvHigh) o.carry.push("Sunscreen");
  return o;
}

/** Feel (°C, after the run-cold/hot shift) at which each layer level begins. Level 4 is everything below level 3. */
export const LEVEL_FLOOR: Record<number, number> = { 1: BANDS[4].max, 2: BANDS[3].max, 3: BANDS[1].max };
export const LEVEL_NAME = ["", "long-sleeve", "hoodie", "hoodie + quarter-zip", "every layer"];

const VERDICT = ["", "Just the long-sleeve.", "Hoodie on.", "Hoodie and quarter-zip.", "Every layer you own."];

/** The decision itself: how many of your layers go on. */
export function verdict(h: Hour, bias: number): string {
  return VERDICT[outfitFor(h, bias).level];
}

/* ---------- Time helpers ---------- */

export const hourOf = (h: Hour) => Number(h.time.slice(11, 13));
export const dateOf = (h: Hour) => h.time.slice(0, 10);

export function clock(h: Hour | number): string {
  const n = typeof h === "number" ? h : hourOf(h);
  if (n === 0) return "midnight";
  if (n === 12) return "noon";
  return n < 12 ? `${n}am` : `${n - 12}pm`;
}

export function weekday(date: string, long = true): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: long ? "long" : "short" });
}

export function temp(c: number, unit: "F" | "C"): string {
  return `${Math.round(unit === "F" ? (c * 9) / 5 + 32 : c)}°`;
}

/* ---------- What changes later today ---------- */

export function moments(hrs: Hour[], bias: number): string[] {
  const out: string[] = [];
  if (hrs.length < 3) return out;
  const now = hrs[0];
  const c0 = conditions(now, bias);
  const b0 = bandIndex(c0.feel);

  for (let i = 1; i < hrs.length - 1; i++) {
    const b = bandIndex(feelOf(hrs[i], bias));
    const b2 = bandIndex(feelOf(hrs[i + 1], bias));
    if (b !== b0 && (b - b0) * (b2 - b0) > 0) {
      const word = BANDS[b].word.toLowerCase();
      if (b > b0) {
        const from = outfitFor(now, bias).level;
        const to = outfitFor(hrs[i], bias).level;
        const drop = to >= from ? "" : from >= 3 ? ` The ${WARDROBE.over.toLowerCase()} can come off.` : ` The ${WARDROBE.mid.toLowerCase()} can come off.`;
        out.push(`Warms up to ${word} by ${clock(hrs[i])}.${drop}`);
      } else {
        out.push(`Turns ${word} around ${clock(hrs[i])}. Bring the next layer if you'll still be out.`);
      }
      break;
    }
  }

  const isPrecip = (h: Hour) => {
    const c = conditions(h, bias);
    return c.wet || c.snowy || c.stormy;
  };
  if (!isPrecip(now)) {
    const h = hrs.slice(1).find(isPrecip);
    if (h) out.push(`${conditions(h, bias).snowy ? "Snow" : "Rain"} likely from ${clock(h)}.`);
  } else {
    const i = hrs.findIndex((h, k) => k > 0 && !isPrecip(h) && (!hrs[k + 1] || !isPrecip(hrs[k + 1])));
    if (i > 0) out.push(`Dries up around ${clock(hrs[i])}.`);
  }

  if (!c0.windy) {
    const h = hrs.slice(1).find((x) => conditions(x, bias).windy);
    if (h) out.push(`Wind picks up around ${clock(h)}.`);
  }

  if (out.length === 0) out.push("Holds like this for the rest of the day. Dress once.");
  return out.slice(0, 3);
}

const BODY = [
  "Bare skin hurts within minutes.",
  "You'll see your breath, and bare fingers go numb.",
  "Cold on your face and hands, fine once you're moving.",
  "Bare arms would get goosebumps.",
  "Fresh. Nice while walking, cool if you sit still.",
  "You won't think about the air at all.",
  "Warm on your skin. You'd sweat in a jacket.",
  "You'll sweat just walking.",
  "Like opening an oven. Find shade.",
];

/** What your body will notice out there. */
export function sensation(h: Hour, bias: number): string {
  const c = conditions(h, bias);
  const i = bandIndex(c.feel);
  let extra = "";
  if (c.wet || c.stormy) extra = " You'll be soaked in minutes without a shell.";
  else if (c.snowy) extra = " Snow will be landing on you.";
  else if (c.windy && i <= 4) extra = " The wind cuts straight through thin layers.";
  else if (c.muggy) extra = " The air sits heavy and damp on you.";
  else if (c.sunny && i <= 3) extra = " Warmer in the sun, sharp in the shade.";
  else if (c.sunny && i >= 7) extra = " The sun presses on you.";
  return BODY[i] + extra;
}

/** Yesterday is the one day everybody remembers dressing for. */
export function versusYesterday(now: Hour, yesterday: Hour | undefined, bias: number): string | null {
  if (!yesterday) return null;
  const d = bandIndex(feelOf(now, bias)) - bandIndex(feelOf(yesterday, bias));
  const wetNow = conditions(now, bias).wet;
  const wetThen = conditions(yesterday, bias).wet;
  const rain = wetNow && !wetThen ? ", plus something waterproof" : "";
  if (d === 0) return `Dress like you did this time yesterday${rain}.`;
  if (d < 0) return `Colder than yesterday. Add ${d <= -2 ? "a couple of layers" : "a layer"}${rain}.`;
  return `Warmer than yesterday. Drop ${d >= 2 ? "a couple of layers" : "a layer"}${rain}.`;
}

/* ---------- Being out for a stretch ---------- */

export function planOuting(hrs: Hour[], bias: number) {
  const byFeel = [...hrs].sort((a, b) => feelOf(a, bias) - feelOf(b, bias));
  const coldest = byFeel[0];
  const warmest = byFeel[byFeel.length - 1];
  const bc = bandIndex(feelOf(coldest, bias));
  const bw = bandIndex(feelOf(warmest, bias));
  const base = outfitFor(coldest, bias);
  const carry = new Set<string>();
  hrs.forEach((h) => outfitFor(h, bias).carry.forEach((x) => carry.add(x)));

  let note: string;
  if (bw - bc >= 2) {
    note = `Wear layers you can peel: ${BANDS[bc].word.toLowerCase()} at ${clock(coldest)}, ${BANDS[bw].word.toLowerCase()} at ${clock(warmest)}.`;
  } else if (bc < bandIndex(feelOf(hrs[0], bias))) {
    note = `Dress for ${clock(coldest)}, not for now. It gets ${BANDS[bc].word.toLowerCase()}.`;
  } else {
    note = "One outfit covers the whole stretch.";
  }
  return { note, wear: base.wear, carry: [...carry], coldest };
}

/* ---------- A whole day, boiled down to one representative hour ---------- */

export type Day = { date: string; rep: Hour; lo: number; hi: number; line: string };

export function summarizeDays(hours: Hour[], nowIndex: number, bias: number): Day[] {
  const groups = new Map<string, Hour[]>();
  hours.slice(nowIndex).forEach((h) => {
    const k = dateOf(h);
    groups.set(k, [...(groups.get(k) ?? []), h]);
  });
  const days: Day[] = [];
  for (const [date, all] of groups) {
    let day = all.filter((h) => hourOf(h) >= 8 && hourOf(h) <= 20);
    if (day.length < 3) day = all;
    if (day.length === 0) continue;
    const sorted = [...day].sort((a, b) => a.feels - b.feels);
    const mid = sorted[Math.floor(sorted.length / 2)];
    const wetHours = day.filter((h) => h.pop >= 50 || h.precip >= 0.3).length;
    const rep: Hour = {
      ...mid,
      isDay: true,
      pop: wetHours >= 2 ? Math.max(...day.map((h) => h.pop)) : Math.min(mid.pop, 40),
      precip: wetHours >= 2 ? Math.max(...day.map((h) => h.precip)) : 0,
      snow: day.some((h) => h.snow > 0) ? Math.max(...day.map((h) => h.snow)) : 0,
      code: wetHours >= 2 || day.some((h) => h.snow > 0) ? Math.max(...day.map((h) => h.code)) : mid.code,
      wind: Math.max(...day.map((h) => h.wind)),
      gust: Math.max(...day.map((h) => h.gust)),
      uv: Math.max(...day.map((h) => h.uv)),
    };
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    const bl = bandIndex(feelOf(lo, bias));
    const bh = bandIndex(feelOf(hi, bias));
    const line =
      bh - bl >= 2
        ? `${BANDS[bl].word} at ${clock(lo)}, ${BANDS[bh].word.toLowerCase()} by ${clock(hi)}.`
        : headline(rep, bias);
    days.push({ date, rep, lo: lo.feels, hi: hi.feels, line });
  }
  return days.slice(0, 7);
}

/* ---------- Body map: which parts will actually feel it, in the suggested outfit ---------- */

export type PartId = "head" | "neck" | "core" | "arms" | "hands" | "legs" | "feet";
/** -1 warm, 0 fine, 1 cool, 2 cold, 3 very cold */
export type Part = { id: PartId; label: string; score: -1 | 0 | 1 | 2 | 3; status: string; tip: string };

const STATUS = { "-1": "Warm", 0: "Fine", 1: "Cool", 2: "Cold", 3: "Very cold" } as const;

export function bodyMap(h: Hour, bias: number): Part[] {
  const c = conditions(h, bias);
  const o = outfitFor(h, bias);
  const wet = c.wet || c.snowy || c.stormy;
  const gust = c.windy ? 4 : 0;
  const coreWarmth = [0, 4, 10, 16, 20][o.level];

  // "Skin temperature" each part ends up at: the feel, plus what covers it, minus wind and wet on exposed parts.
  const at: Record<PartId, number> = {
    head: c.feel + (o.beanie ? 12 : o.level >= 2 && wet ? 6 : 0) - (o.beanie ? 0 : gust),
    neck: c.feel + (o.level >= 3 ? 7 : o.level === 2 ? 4 : 0) - gust / 2,
    core: c.feel + coreWarmth,
    arms: c.feel + coreWarmth - 3,
    hands: c.feel - 3 + (o.gloves ? 12 : 0) - (o.gloves ? 0 : gust),
    legs: c.feel + (o.sweats ? 9 : 6) - (o.sweats ? 0 : gust / 2) - (wet ? 3 : 0),
    feet: c.feel + 6 - (wet ? 6 : 0),
  };
  const score = (t: number): Part["score"] => (t >= 30 ? -1 : t >= 15 ? 0 : t >= 9 ? 1 : t >= 2 ? 2 : 3);

  const tips: Record<PartId, (s: number) => string> = {
    head: (s) => (o.beanie ? "Hat covers your ears." : s >= 2 ? (o.level >= 2 ? "Ears are exposed. Hood up." : "Ears are exposed.") : s === 1 ? "Ears will notice the air." : "No cover needed."),
    neck: (s) => (s >= 2 ? (o.level >= 3 ? "Zip the quarter-zip all the way up." : "Open to the air. Hood up helps.") : s === 1 ? "A little draft at the collar." : "No cover needed."),
    core: (s) => (s >= 2 ? "Past what these layers can hold. Keep moving." : s === 1 ? "Just enough. You'll feel it standing still." : s === -1 ? "Too much on. Push your sleeves up." : "Your layers have this."),
    arms: (s) => (s >= 2 ? "Sleeves alone won't hold the cold out." : s === 1 ? "Fine moving, cool at rest." : s === -1 ? "Sleeves up." : "Covered."),
    hands: (s) => (o.gloves ? (s >= 2 ? "Even in gloves. Keep them in pockets too." : "Gloves on.") : s >= 2 ? "Bare and exposed. Pockets, or gloves." : s === 1 ? "Pockets when you stop." : "Fine bare."),
    legs: (s) => (s >= 2 ? (o.sweats ? "One layer of sweatpants only goes so far." : "Jeans let the wind and cold through.") : s === 1 ? "You'll feel the air through them." : "Fine."),
    feet: (s) => (wet ? "Wet ground. Wet feet go cold fast." : s >= 2 ? "Thick socks. Thin sneakers will bite." : s === 1 ? "Normal socks are enough." : "Fine."),
  };
  const labels: Record<PartId, string> = { head: "Head and ears", neck: "Neck", core: "Chest and core", arms: "Arms", hands: "Hands", legs: "Legs", feet: "Feet" };

  return (Object.keys(at) as PartId[]).map((id) => {
    const s = score(at[id]);
    return { id, label: labels[id], score: s, status: STATUS[s], tip: tips[id](s) };
  });
}
