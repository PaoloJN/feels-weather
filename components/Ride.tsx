import { clock, hourOf, temp, weekday, type RideOutlook } from "@/lib/feel";

const GREEN = "#62D96B";
const WET = "#4C90F0";

const shortDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

/** Countdown to the next warm, dry, partly sunny stretch, with each forecast day's peak drawn against the warm line. */
export default function Ride({ ride, unit }: { ride: RideOutlook; unit: "F" | "C" }) {
  const { next, closest, days, floor } = ride;
  const peaks = days.map((d) => d.peak);
  const lo = Math.min(floor, ...peaks) - 4;
  const hi = Math.max(floor, ...peaks) + 3;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const degrees = (c: number) => Math.max(1, Math.round(unit === "F" ? (c * 9) / 5 : c));

  // A window's last hour runs to the top of the next one.
  const until = next ? clock((hourOf(next.end) + 1) % 24) : "";
  const big = !next ? `${days.length}+` : next.now ? "Go" : next.daysAway === 0 ? clock(next.start) : String(next.daysAway);
  const unitWord = !next ? "days" : next.now || next.daysAway === 0 ? "" : next.daysAway === 1 ? "day" : "days";
  const title = !next
    ? "No nice weather in sight."
    : next.now
      ? "Nice out right now."
      : next.daysAway === 0
        ? "Nice out later today."
        : "Until it's nice out.";
  const detail = !next
    ? closest && `Closest is ${shortDate(closest.date)}: ${temp(closest.peak, unit)}, ${degrees(floor - closest.peak)}° short.`
    : next.now
      ? `Warm, dry and some sun until ${until}.`
      : `${next.daysAway === 0 ? "Today" : next.daysAway === 1 ? "Tomorrow" : shortDate(next.start.time.slice(0, 10))}, ${clock(next.start)} to ${until}.`;

  return (
    <div>
      <div className="flex items-center gap-3">
        <p className="flex items-baseline gap-1.5 font-semibold leading-none tabular-nums" style={{ color: next ? GREEN : "#8f8f8f" }}>
          <span className="text-5xl">{big}</span>
          {unitWord && <span className="text-base">{unitWord}</span>}
        </p>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {detail && <p className="mt-0.5 text-dim">{detail}</p>}
        </div>
      </div>

      <div className="relative mt-4 flex h-20 items-end gap-0.5" role="img" aria-label={`Warmest daytime feels-like for each of the next ${days.length} days, against the warm line`}>
        {days.map((d) => (
          <span
            key={d.date}
            title={`${shortDate(d.date)}: peaks at ${temp(d.peak, unit)}${d.state === "ride" ? ", nice out" : d.state === "wet" ? ", warm enough but grey or wet" : ", too cold"}`}
            className="flex-1 rounded-t-[1px]"
            style={{ height: `${pct(d.peak)}%`, background: d.state === "ride" ? GREEN : d.state === "wet" ? WET : "#454545" }}
          />
        ))}
        <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/60" style={{ bottom: `${pct(floor)}%` }}>
          <span className="absolute right-0 -top-2 rounded-[2px] bg-panel px-1 text-xs leading-4 text-dim">warm line {temp(floor, unit)}</span>
        </span>
      </div>
      <div className="mt-1 flex gap-0.5 text-center text-[10px] text-mute" aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.date} className="flex-1">{i === 0 ? "now" : weekday(d.date, false).slice(0, 2)}</span>
        ))}
      </div>

      <p className="mt-2 text-xs text-mute">
        Nice: daylight, dry, some sun, and feels like {temp(floor, unit)} or warmer for two hours. Blue: warm enough but grey or wet.
      </p>
    </div>
  );
}
