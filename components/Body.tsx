import type { Part, PartId } from "@/lib/feel";

/** Lighter means colder, like frost building up. Amber means too warm. */
export const PART_COLOR: Record<string, string> = { "-1": "#EC9A3C", "0": "#5C5C5C", "1": "#2D72D2", "2": "#8ABBFF", "3": "#f5f5f5" };

// Left half of the figure (viewer's left); `both` shapes are mirrored across x=120.
const SHAPES: Record<PartId, { center?: string[]; both?: string[] }> = {
  head: {
    center: ["M120,12 C137,12 145,27 144,46 C143,61 137,73 129,80 Q120,86 111,80 C103,73 97,61 96,46 C95,27 103,12 120,12 Z"],
    both: ["M96,42 Q89,40 90,50 Q91,60 97,60 Z"],
  },
  neck: { center: ["M107,84 Q120,92 133,84 L136,101 Q120,108 104,101 Z"] },
  core: {
    center: ["M101,160 Q120,169 139,160 L136,224 Q120,252 104,224 Z"],
    both: [
      "M118,107 L118,153 Q99,162 84,149 Q75,130 82,114 Q100,102 118,107 Z",
      "M82,154 Q91,161 98,162 L101,227 Q91,225 86,214 Q79,182 82,154 Z",
      "M103,100 Q92,104 84,109 Q94,100 104,95 Z",
    ],
  },
  arms: {
    both: [
      "M80,111 Q61,108 53,127 Q49,143 55,156 Q70,152 78,139 Q75,125 80,111 Z",
      "M54,160 Q66,158 77,146 Q81,172 70,198 L49,203 Q45,178 54,160 Z",
      "M48,207 L69,202 Q66,234 51,264 L36,258 Q38,228 48,207 Z",
    ],
  },
  hands: { both: ["M35,262 L50,268 Q51,286 44,302 Q36,308 31,299 Q28,279 35,262 Z"] },
  legs: {
    both: [
      "M86,220 Q95,233 103,234 Q112,250 118,264 L116,342 Q104,354 92,342 Q80,282 86,220 Z",
      "M92,358 Q104,366 115,358 Q118,402 110,454 L98,454 Q88,402 92,358 Z",
    ],
  },
  feet: { both: ["M97,460 L111,460 Q114,478 110,492 Q98,500 85,492 Q88,476 97,460 Z"] },
};

// Where each label sits and the point on the body its leader line starts from.
const LABEL: Record<PartId, { side: "l" | "r"; y: number; from: [number, number] }> = {
  head: { side: "r", y: 34, from: [144, 40] },
  neck: { side: "l", y: 84, from: [106, 93] },
  core: { side: "r", y: 132, from: [150, 132] },
  arms: { side: "l", y: 176, from: [52, 178] },
  hands: { side: "r", y: 282, from: [204, 284] },
  legs: { side: "l", y: 300, from: [84, 300] },
  feet: { side: "r", y: 476, from: [150, 478] },
};

export default function Body({ parts }: { parts: Part[] }) {
  const notable = parts.filter((p) => p.score !== 0);
  return (
    <div>
      <svg viewBox="-150 0 540 512" className="mx-auto block w-full max-w-[460px]" role="img" aria-label={parts.map((p) => `${p.label}: ${p.status}`).join(". ")}>
        <defs>
          <radialGradient id="body-floor" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#8abbff" stopOpacity=".18" />
            <stop offset="1" stopColor="#8abbff" stopOpacity="0" />
          </radialGradient>
          <filter id="body-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <ellipse cx="120" cy="494" rx="110" ry="14" fill="url(#body-floor)" />

        {parts.map((p) => {
          const s = SHAPES[p.id];
          const fill = PART_COLOR[p.score];
          const draw = (key: string, glow: boolean) => (
            <g key={key} fill={fill} stroke={glow ? "none" : "#f5f5f5"} strokeWidth="1.5" strokeLinejoin="round" filter={glow ? "url(#body-glow)" : undefined} opacity={glow ? 0.55 : 1}>
              {s.center?.map((d) => <path key={d} d={d} />)}
              {s.both?.map((d) => <path key={d} d={d} />)}
              <g transform="translate(240,0) scale(-1,1)">{s.both?.map((d) => <path key={d} d={d} />)}</g>
            </g>
          );
          // Parts that are cold get a soft halo so they stand out before you read anything.
          return [p.score >= 2 || p.score === -1 ? draw(`${p.id}-glow`, true) : null, draw(p.id, false)];
        })}

        {/* abdominal lines, drawn over the core */}
        <g stroke="#f5f5f5" strokeWidth="1.2" strokeLinecap="round" opacity=".7" fill="none">
          <path d="M120,166 V236" />
          <path d="M106,180 Q120,185 134,180 M105,198 Q120,203 135,198 M106,216 Q120,221 134,216" />
        </g>

        {parts.map((p) => {
          const l = LABEL[p.id];
          const x = l.side === "r" ? 262 : -22;
          const color = p.score === 0 ? "#adadad" : p.score === 1 ? "#4C90F0" : PART_COLOR[p.score];
          return (
            <g key={p.id}>
              <path d={`M${l.from[0]},${l.from[1]} L${l.side === "r" ? x - 30 : x + 30},${l.y} H${l.side === "r" ? x - 6 : x + 6}`} fill="none" stroke="#8f8f8f" strokeWidth="1" />
              <circle cx={l.from[0]} cy={l.from[1]} r="2.6" fill="#f5f5f5" />
              <text x={x} y={l.y - 2} textAnchor={l.side === "r" ? "start" : "end"} fill="#f5f5f5" fontSize="14" fontWeight="600">{p.label}</text>
              <text x={x} y={l.y + 15} textAnchor={l.side === "r" ? "start" : "end"} fill={color} fontSize="13" fontWeight={p.score >= 2 ? 600 : 400}>{p.status}</text>
            </g>
          );
        })}
      </svg>

      <ul className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-dim" aria-hidden="true">
        {([["0", "Fine"], ["1", "Cool"], ["2", "Cold"], ["3", "Very cold"]] as const).map(([k, name]) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[1px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.5)]" style={{ background: PART_COLOR[k] }} />
            {name}
          </li>
        ))}
      </ul>

      {notable.length > 0 && (
        <dl className="mt-3 divide-y divide-white/10 border-t border-white/10">
          {notable.map((p) => (
            <div key={p.id} className="flex gap-3 py-1.5">
              <dt className="w-28 shrink-0 text-dim">{p.label}</dt>
              <dd className="min-w-0">{p.tip}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
