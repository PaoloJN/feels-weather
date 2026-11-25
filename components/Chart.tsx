"use client";

import { useEffect, useRef, useState } from "react";
import type { Hour } from "@/lib/weather";
import { LEVEL_FLOOR, LEVEL_NAME, clock, conditions, outfitFor, temp } from "@/lib/feel";

// Blueprint extended palette: gold, forest, cerulean, indigo.
export const LEVEL_COLOR = ["", "#F0B726", "#62D96B", "#68C1EE", "#BDADFF"];

type Props = {
  hrs: Hour[];
  bias: number;
  unit: "F" | "C";
  active: number; // index into hrs
  startsNow: boolean;
  onPick: (i: number) => void;
};

/** The feels-like line for a stretch of hours, drawn over the bands where each layer level applies. */
export default function Chart({ hrs, bias, unit, active, startsNow, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const H = W < 520 ? 270 : 400;
  const L = 42, R = 10, T = 22, RAIN = 24, B = 26;
  const plotB = H - B - RAIN;
  const n = hrs.length;

  const feels = hrs.map((h) => h.feels);
  let lo = Math.min(...feels) - 3;
  let hi = Math.max(...feels) + 3;
  if (hi - lo < 16) {
    const mid = (hi + lo) / 2;
    lo = mid - 8;
    hi = mid + 8;
  }
  const step = n > 1 ? (W - L - R) / (n - 1) : 0;
  const x = (i: number) => L + i * step;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (plotB - T);

  // Running cold shifts every threshold up: you need each layer sooner.
  const shift = bias * 2;
  const f1 = LEVEL_FLOOR[1] - shift, f2 = LEVEL_FLOOR[2] - shift, f3 = LEVEL_FLOOR[3] - shift;
  const bands = [
    { level: 1, from: f1, to: Infinity },
    { level: 2, from: f2, to: f1 },
    { level: 3, from: f3, to: f2 },
    { level: 4, from: -Infinity, to: f3 },
  ]
    .map((b) => ({ ...b, top: y(Math.min(hi, b.to)), bottom: y(Math.max(lo, b.from)) }))
    .filter((b) => b.bottom - b.top > 1);

  const levels = hrs.map((h) => outfitFor(h, bias).level);
  const iMax = feels.indexOf(Math.max(...feels));
  const iMin = feels.indexOf(Math.min(...feels));

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - L) / (step || 1));
    onPick(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={box}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label="Feels-like temperature over time, drawn over the bands for each layer level"
          className="block touch-pan-y select-none text-[11px]"
          onPointerDown={pick}
          onPointerMove={(e) => (e.buttons > 0 || e.pointerType === "mouse") && pick(e)}
        >
          {bands.map((b) => (
            <g key={b.level}>
              <rect x={L} y={b.top} width={W - L - R} height={b.bottom - b.top} fill={LEVEL_COLOR[b.level]} opacity=".16" />
              {b.bottom - b.top > 18 && (
                <text x={W - R - 6} y={b.top + 13} textAnchor="end" fill={LEVEL_COLOR[b.level]} fontWeight="600">
                  {b.level} {LEVEL_NAME[b.level]}
                </text>
              )}
            </g>
          ))}

          {/* thresholds: where one more layer goes on */}
          {[f1, f2, f3].filter((v) => v > lo && v < hi).map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#f5f5f5" strokeOpacity=".35" strokeDasharray="2 4" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" fill="#adadad">{temp(v, unit)}</text>
            </g>
          ))}

          {/* night */}
          {hrs.map((h, i) => !h.isDay && (
            <rect key={h.time} x={Math.max(L, x(i) - step / 2)} y={T} width={Math.min(step, W - R - Math.max(L, x(i) - step / 2))} height={plotB - T} fill="#000" opacity=".28" />
          ))}

          {/* rain and snow chance */}
          {hrs.map((h, i) => {
            if (h.pop < 20 && h.precip < 0.3) return null;
            const hgt = Math.max(3, (Math.max(h.pop, 30) / 100) * (RAIN - 4));
            return <rect key={h.time} x={x(i) - Math.max(2, step / 2 - 1.5)} y={plotB + RAIN - hgt} width={Math.max(4, step - 3)} height={hgt} fill={conditions(h, bias).snowy ? "#f5f5f5" : "#4C90F0"} opacity=".8" />;
          })}
          <line x1={L} x2={W - R} y1={plotB + RAIN} y2={plotB + RAIN} stroke="#454545" />

          {/* the feel */}
          <polyline fill="none" stroke="#f5f5f5" strokeWidth="2.5" strokeLinejoin="round" points={feels.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          {hrs.map((h, i) => (
            <circle key={h.time} cx={x(i)} cy={y(h.feels)} r={i === active ? 0 : 3} fill={LEVEL_COLOR[levels[i]]} stroke="#1c1c1c" strokeWidth="1" />
          ))}
          {[...new Set([iMax, iMin])].filter((i) => i !== active && x(i) < W - 190).map((i) => (
            <text key={i} x={Math.min(W - R - 14, Math.max(L + 14, x(i)))} y={y(feels[i]) + (i === iMax ? -9 : 17)} textAnchor="middle" fill="#f5f5f5">
              {temp(feels[i], unit)}
            </text>
          ))}

          {/* the hour being read */}
          <line x1={x(active)} x2={x(active)} y1={T - 6} y2={plotB + RAIN} stroke={LEVEL_COLOR[levels[active]]} strokeWidth="1.5" />
          <circle cx={x(active)} cy={y(feels[active])} r="6.5" fill={LEVEL_COLOR[levels[active]]} stroke="#1c1c1c" strokeWidth="2" />
          <text x={Math.min(W - R - 16, Math.max(L + 16, x(active)))} y={T - 10} textAnchor="middle" fill={LEVEL_COLOR[levels[active]]} fontWeight="700">
            {temp(feels[active], unit)}
          </text>

          {hrs.map((h, i) => (i % (W < 520 ? 4 : 3) === 0 ? (
            <text key={h.time} x={x(i)} y={H - 7} textAnchor={i === 0 ? "start" : "middle"} fill="#adadad">
              {i === 0 && startsNow ? "now" : clock(h)}
            </text>
          ) : null))}
        </svg>
      )}
      <input
        type="range" min={0} max={n - 1} step={1} value={active}
        onChange={(e) => onPick(Number(e.target.value))}
        aria-label="Hour to read"
        aria-valuetext={clock(hrs[active])}
        className="sr-only"
      />
    </div>
  );
}
