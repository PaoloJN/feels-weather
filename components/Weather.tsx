"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Body from "./Body";
import Chart, { LEVEL_COLOR } from "./Chart";
import { fetchForecast, fetchNearby, searchPlaces, type Forecast, type Hour, type Place } from "@/lib/weather";
import {
  LEVEL_NAME, bodyMap, clock, conditions, dateOf, headline, moments, outfitFor, planOuting,
  sensation, summarizeDays, temp, verdict, versusYesterday, weekday,
} from "@/lib/feel";

type Settings = { place: Place | null; unit: "F" | "C"; bias: number };

const KEY = "feels-like:v1";
const biasLabel = (b: number) =>
  b <= -1.5 ? "I run very cold" : b <= -0.5 ? "I run cold" : b < 0.5 ? "I'm average" : b < 1.5 ? "I run hot" : "I run very hot";

function readSaved(): Settings {
  const fallback: Settings = { place: null, unit: "F", bias: -1 };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return fallback;
  }
}

export default function Weather() {
  const [settings, setSettings] = useState<Settings>(readSaved);
  const [data, setData] = useState<Forecast | null>(null);
  const [nearby, setNearby] = useState<Hour[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(() => !settings.place && "geolocation" in navigator);
  const [picking, setPicking] = useState(() => !settings.place && !("geolocation" in navigator));
  const [day, setDay] = useState<string | null>(null); // null = the next 24 hours
  const [hour, setHour] = useState<number | null>(null); // index into the charted hours
  const [outFor, setOutFor] = useState(4);
  const [thanks, setThanks] = useState<string | null>(null);

  const { place, unit, bias } = settings;
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const requestPosition = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPicking(false);
        update({ place: { lat: pos.coords.latitude, lon: pos.coords.longitude, name: "Where you are" } });
      },
      () => {
        setLocating(false);
        setPicking(true);
      },
      { timeout: 8000, maximumAge: 600000 },
    );
  }, [update]);

  const locate = () => {
    setLocating(true);
    requestPosition();
  };

  // On a first visit, ask the browser where we are.
  const hasPlace = !!place;
  useEffect(() => {
    if (!hasPlace) requestPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    if (!place) return;
    fetchForecast(place)
      .then((f) => {
        setError(null);
        setData(f);
        fetchNearby(place).then(setNearby).catch(() => setNearby(null));
        setDay(null);
        setHour(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [place]);

  // Fetch on place change, then refresh every 15 minutes and when the tab comes back.
  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const view = useMemo(() => {
    if (!data) return null;
    const { hours, nowIndex } = data;
    const now = hours[nowIndex];
    const next24 = hours.slice(nowIndex, nowIndex + 24);
    const days = summarizeDays(hours, nowIndex, bias);
    return { hours, nowIndex, now, next24, days };
  }, [data, bias]);

  if (locating && !place) {
    return (
      <Shell>
        <p className="text-dim">Finding where you are…</p>
      </Shell>
    );
  }

  if (!place || picking) {
    return (
      <Shell>
        <PlacePicker
          locating={locating}
          canCancel={!!place}
          onLocate={locate}
          onCancel={() => setPicking(false)}
          onPick={(p) => {
            update({ place: p });
            setPicking(false);
          }}
        />
      </Shell>
    );
  }

  if (error && !view) {
    return (
      <Shell>
        <p className="text-xl font-bold">Couldn&apos;t reach the forecast.</p>
        <p className="mt-2 text-sm text-dim">{error}. Check your connection and try again.</p>
        <button onClick={load} className="mt-6 h-[30px] rounded-[2px] bg-blue px-3 text-sm font-medium text-white">
          Try again
        </button>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <p className="text-dim">Reading the air…</p>
      </Shell>
    );
  }

  const picked = day ? view.days.find((d) => d.date === day) : undefined;
  const charted = picked ? view.hours.filter((h) => dateOf(h) === picked.date) : view.next24;
  const isNow = !picked && (hour === null || hour === 0);
  const active = hour ?? (picked ? Math.max(0, charted.findIndex((h) => h.time === picked.rep.time)) : 0);
  const h = charted[Math.min(active, charted.length - 1)];
  const outfit = outfitFor(h, bias);
  const cond = conditions(h, bias);
  const color = LEVEL_COLOR[outfit.level];
  const outing = planOuting(view.next24.slice(0, outFor + 1), bias);
  const yesterday = versusYesterday(view.now, view.hours[view.nowIndex - 24], bias);
  const speed = unit === "F" ? `${Math.round(h.wind * 0.621)} mph` : `${Math.round(h.wind)} km/h`;
  const when = isNow ? "now" : `${picked ? weekday(picked.date, false) : dateOf(h) === dateOf(view.now) ? "today" : "tomorrow"} ${clock(h)}`;

  const weekLo = Math.min(...view.days.map((d) => d.lo));
  const weekHi = Math.max(...view.days.map((d) => d.hi));
  const pct = (v: number) => ((weekHi - v) / Math.max(1, weekHi - weekLo)) * 100;

  const btn = "h-[30px] rounded-[2px] bg-well px-2.5 text-sm font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)] hover:bg-line";
  const levelNow = outfit.level;

  return (
    <div className="min-h-dvh">
      {/* Top bar, exactly as wide as the cards */}
      <header className="sticky top-0 z-10 mx-auto max-w-[1400px] bg-field px-3 pt-3">
        <div className="flex min-h-[46px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[4px] bg-panel px-4 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)]">
        <span className="flex items-center gap-2 text-base font-semibold">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="#8abbff" d="M1 4h14v2H1zm0 3.5h14v2H1zM1 11h14v2H1z" /></svg>
          Feels Like
        </span>
        <span className="h-5 w-px bg-line" />
        <button onClick={() => setPicking(true)} className="h-[30px] rounded-[2px] px-2 text-sm text-dim hover:bg-well hover:text-ink">
          {place.name}
        </button>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-dim">
            {biasLabel(bias)}
            <input
              type="range" min={-2} max={2} step={0.5} value={bias}
              onChange={(e) => update({ bias: Number(e.target.value) })}
              aria-label="How you run, from very cold to very hot"
              className="w-24 accent-blue"
            />
          </label>
          <span className="flex" role="group" aria-label="Temperature unit">
            {(["F", "C"] as const).map((u) => (
              <button
                key={u}
                onClick={() => update({ unit: u })}
                aria-pressed={unit === u}
                className={`h-[30px] px-2.5 text-sm font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)] first:rounded-l-[2px] last:rounded-r-[2px] ${unit === u ? "bg-blue text-white" : "bg-well text-dim"}`}
              >
                °{u}
              </button>
            ))}
          </span>
        </span>
      </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-3 p-3 lg:grid-cols-12">
        {/* Key readings */}
        <section aria-live="polite" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-12 lg:grid-cols-12">
          <div className="col-span-2 flex items-center gap-4 rounded-[4px] bg-panel p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)] sm:col-span-4" style={{ borderLeft: `3px solid ${color}` }}>
            <p className="text-7xl font-semibold leading-none tabular-nums" style={{ color }}>{levelNow}</p>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-xs text-dim">
                Layer level
                <Tag color={color}>{when}</Tag>
                {!isNow && (
                  <button onClick={() => { setDay(null); setHour(null); }} className="text-sky hover:underline">Reset to now</button>
                )}
              </p>
              <h1 className="mt-1 text-xl font-semibold leading-tight">{verdict(h, bias)}</h1>
              <div className="mt-2 flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4].map((l) => (
                  <span key={l} className="h-1.5 w-9 rounded-[1px]" style={{ background: l <= levelNow ? color : "#454545" }} />
                ))}
              </div>
            </div>
          </div>
          <Metric label="Feels like" value={temp(cond.feel - bias * 2, unit)} sub={headline(h, bias).replace(".", "")} />
          <Metric label="Air temperature" value={temp(h.t, unit)} sub={`${Math.round(h.rh)}% humidity`} />
          <Metric label="Wind" value={speed} sub={cond.windy ? "Strong enough to matter" : "Not a factor"} />
          <Metric label={cond.snowy ? "Snow chance" : "Rain chance"} value={`${Math.round(h.pop)}%`} sub={h.pop >= 50 ? "Plan for it" : h.pop >= 20 ? "Possible" : "Dry"} />
        </section>

        {/* Chart */}
        <div className="flex flex-col gap-3 lg:col-span-4">
          <Card className="flex-1" title="Briefing">
          <p>{sensation(h, bias)}</p>
          <dl className="mt-3 divide-y divide-white/10 border-y border-white/10">
            <Row k="Wear">{outfit.wear.join(". ")}.</Row>
            {outfit.carry.length > 0 && <Row k="Take">{outfit.carry.join(", ")}.</Row>}
            {isNow && yesterday && <Row k="Vs. yesterday">{yesterday}</Row>}
          </dl>
          {!picked && (
            <>
              <h3 className="mt-4 text-xs font-semibold text-dim">Changes ahead</h3>
              <ul className="mt-1.5 space-y-1.5">
                {moments(view.next24.slice(0, 16), bias).map((m) => (
                  <li key={m} className="rounded-[2px] bg-blue/15 px-2.5 py-2 text-sky">{m}</li>
                ))}
              </ul>
            </>
          )}
          </Card>

          <Card title="Outing planner">
            <label className="flex items-center gap-2 text-dim">
              Out until
              <select
                value={outFor}
                onChange={(e) => setOutFor(Number(e.target.value))}
                className={`${btn} cursor-pointer text-ink`}
              >
                {view.next24.slice(1, 17).map((x, i) => (
                  <option key={x.time} value={i + 1}>
                    {clock(x)}{dateOf(x) !== dateOf(view.now) ? " tomorrow" : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 font-medium">{outing.note}</p>
            <p className="mt-1 text-dim">
              Wear {outing.wear.join(", ").toLowerCase()}.
              {outing.carry.length > 0 && ` Take ${outing.carry.join(", ").toLowerCase()}.`}
            </p>
          </Card>
        </div>

        <Card
          className="lg:col-span-8"
          title="Feels-like vs. layer thresholds"
          right={<Tag>{picked ? weekday(picked.date) : "Next 24 hours"}</Tag>}
        >
          <Chart hrs={charted} bias={bias} unit={unit} active={Math.min(active, charted.length - 1)} startsNow={!picked} onPick={setHour} />
          <p className="mt-2 text-xs text-mute">
            White line: how it feels. Bands: your layer levels. Dashed lines: where one more layer goes on. Blue bars: rain chance. Shaded: night. Hover to read any hour.
          </p>
        </Card>

        <Card className="self-start lg:col-span-4" title="Where you'll feel it" right={<span className="text-xs text-mute">in this outfit</span>}>
          <Body parts={bodyMap(h, bias)} />
        </Card>

        <div className="grid content-start gap-3 lg:col-span-8">
        {/* Week */}
        <Card title="7-day outlook" right={<span className="text-xs text-mute">Select a row to chart that day</span>} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-dim">
                <tr className="shadow-[inset_0_-1px_0_rgba(255,255,255,.15)]">
                  {["Day", "Level", "Wear", "Daytime range", "High", "Low", "Conditions"].map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.days.map((d, i) => {
                  const lvl = outfitFor(d.rep, bias).level;
                  const worst = Math.max(lvl, outfitFor({ ...d.rep, feels: d.lo }, bias).level);
                  const on = picked?.date === d.date;
                  const c = conditions(d.rep, bias);
                  return (
                    <tr
                      key={d.date}
                      onClick={() => { setDay(on ? null : d.date); setHour(null); }}
                      className={`cursor-pointer shadow-[inset_0_-1px_0_rgba(255,255,255,.08)] ${on ? "bg-blue/20" : i % 2 ? "bg-white/[.03] hover:bg-well" : "hover:bg-well"}`}
                    >
                      <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium">
                        <button aria-pressed={on} className="text-left">
                          {i === 0 && d.date === dateOf(view.now) ? "Today" : weekday(d.date)}
                        </button>
                      </th>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Tag color={LEVEL_COLOR[lvl]} solid>{lvl}</Tag>
                        {worst > lvl && <span className="ml-1.5 text-xs" style={{ color: LEVEL_COLOR[worst] }}>low {worst}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-dim">{LEVEL_NAME[lvl]}</td>
                      <td className="px-3 py-2">
                        <span className="relative block h-2 w-full min-w-28 rounded-[1px] bg-well">
                          <span className="absolute inset-y-0 rounded-[1px]" style={{ left: `${100 - pct(d.lo)}%`, right: `${pct(d.hi)}%`, minWidth: 4, background: LEVEL_COLOR[lvl] }} />
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{temp(d.hi, unit)}</td>
                      <td className="px-3 py-2 tabular-nums text-dim">{temp(d.lo, unit)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-dim">
                        {d.line.replace(/\.$/, "")}
                        {(c.wet || c.snowy) && <span className="ml-2"><Tag color="#4C90F0">{c.snowy ? "snow" : "wet"}</Tag></span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

          <div className="grid items-start gap-3 md:grid-cols-2">
          {nearby && nearby.length === 25 && (
            <Card title="Nearby right now" right={<span className="text-xs text-mute">feels-like and layer level</span>}>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-xs text-mute">
                <span />
                <span className="text-center">North</span>
                <span />
                <span>W</span>
                <div className="grid grid-cols-5 gap-0.5">
                  {nearby.map((n, i) => {
                    const lvl = outfitFor(n, bias).level;
                    return (
                      <div
                        key={i}
                        title={`${verdict(n, bias)} ${headline(n, bias)}`}
                        className={`flex aspect-square flex-col items-center justify-center rounded-[2px] leading-tight ${i === 12 ? "shadow-[inset_0_0_0_2px_#f5f5f5]" : ""}`}
                        style={{ background: `color-mix(in srgb, ${LEVEL_COLOR[lvl]} ${i === 12 ? 45 : 28}%, #1c1c1c)` }}
                      >
                        <span className="text-sm font-semibold tabular-nums text-ink">{temp(n.feels, unit)}</span>
                        <span style={{ color: LEVEL_COLOR[lvl] }}>{i === 12 ? "you" : `L${lvl}`}</span>
                      </div>
                    );
                  })}
                </div>
                <span>E</span>
                <span />
                <span className="text-center">South</span>
                <span />
              </div>
              <p className="mt-2 text-xs text-mute">Each square is about {unit === "F" ? "10 miles" : "17 km"} from the next. The outlined one is you.</p>
            </Card>
          )}

            <div className="grid content-start gap-3">
          <Card title="Calibration">
            <p className="text-dim">{thanks ?? "Been out in this? Report how it felt and the thresholds adjust."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([["Too cold", -0.5], ["Just right", 0], ["Too warm", 0.5]] as const).map(([label, step]) => (
                <button
                  key={label}
                  onClick={() => {
                    update({ bias: Math.max(-2, Math.min(2, bias + step)) });
                    setThanks(step < 0 ? "Recorded. Layers go on sooner now." : step > 0 ? "Recorded. Layers go on later now." : "Recorded. Thresholds unchanged.");
                  }}
                  className={btn}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-mute">Each report moves the threshold lines by about {unit === "F" ? "2°F" : "1°C"}.</p>
          </Card>
            </div>
          </div>
        </div>

        <p className="text-xs text-mute lg:col-span-12">
          {error ? `Couldn't refresh just now (${error}). Showing the last forecast. ` : ""}Source: Open-Meteo.
        </p>
      </main>
    </div>
  );
}

function Card(props: { title: string; right?: React.ReactNode; className?: string; flush?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-[4px] bg-panel shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)] ${props.className ?? ""}`}>
      <div className="flex min-h-10 items-center justify-between gap-3 px-3 shadow-[inset_0_-1px_0_rgba(255,255,255,.15)]">
        <h2 className="font-semibold">{props.title}</h2>
        {props.right}
      </div>
      <div className={props.flush ? "" : "p-3"}>{props.children}</div>
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[4px] bg-panel p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)] lg:col-span-2">
      <p className="text-xs text-dim">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 truncate text-xs text-mute">{sub}</p>
    </div>
  );
}

function Tag({ children, color = "#adadad", solid }: { children: React.ReactNode; color?: string; solid?: boolean }) {
  return (
    <span
      className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-[2px] px-1.5 text-xs font-medium"
      style={solid ? { background: color, color: "#121212", fontWeight: 700 } : { background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <dt className="w-24 shrink-0 text-dim">{k}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-xl p-6">{children}</main>;
}

function PlacePicker(props: {
  locating: boolean;
  canCancel: boolean;
  onLocate: () => void;
  onCancel: () => void;
  onPick: (p: Place) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [failed, setFailed] = useState(false);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setFailed(false);
    searchPlaces(q.trim()).then(setResults).catch(() => setFailed(true));
  };

  return (
    <div className="max-w-md pt-10">
      <h1 className="text-xl font-semibold">Where are you heading out from?</h1>
      <form onSubmit={search} className="mt-8 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="City or town"
          aria-label="City or town"
          autoFocus
          className="h-[30px] min-w-0 flex-1 rounded-[2px] bg-field px-2.5 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)] placeholder:text-mute"
        />
        <button className="h-[30px] rounded-[2px] bg-blue px-3 text-sm font-medium text-white">Search</button>
      </form>
      {failed && <p className="mt-3">Place search didn&apos;t respond. Try again in a moment.</p>}
      {results && results.length === 0 && <p className="mt-3">No place by that name. Try a nearby city.</p>}
      {results && results.length > 0 && (
        <ul className="mt-4 space-y-1">
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button onClick={() => props.onPick(p)} className="py-1 text-sm font-semibold text-sky hover:underline">
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex gap-5 text-sm font-semibold">
        <button onClick={props.onLocate} disabled={props.locating} className="text-sky hover:underline disabled:opacity-60">
          {props.locating ? "Finding you…" : "Use my location"}
        </button>
        {props.canCancel && (
          <button onClick={props.onCancel} className="text-sky hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
