import { mascot } from "./mascots.ts";

type Axis = { id: string; title: string; value: number };

const SIZE = 320;
const R = 110;
const C = SIZE / 2;
// Paint lives in attributes, not CSS classes: html-to-image drops class-based SVG paint.
const ACCENT = "#e0763c";
const ring = { fill: "none", stroke: "currentColor", strokeOpacity: 0.35 };

const point = (i: number, n: number, r: number) => {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};

// Coverage per group, drawn without numbers so it can go on the share card.
export function Radar({ axes }: { axes: Axis[] }) {
  const n = axes.length;
  const shape = axes.map((a, i) => point(i, n, Math.max(a.value, 0.02) * R).join(",")).join(" ");
  return (
    <svg className="radar" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Coverage per group">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} {...ring} points={axes.map((_, i) => point(i, n, f * R).join(",")).join(" ")} />
      ))}
      {n < 3 && <circle {...ring} cx={C} cy={C} r={R} />}
      {axes.map((a, i) => {
        const [x, y] = point(i, n, R);
        const [lx, ly] = point(i, n, R + 26);
        return (
          <g key={a.id}>
            <line {...ring} x1={C} y1={C} x2={x} y2={y} />
            <image href={mascot(a.id).src} x={lx - 14} y={ly - 14} width={28} height={28}>
              <title>{a.title}</title>
            </image>
          </g>
        );
      })}
      <polygon points={shape} fill={ACCENT} fillOpacity={0.3} stroke={ACCENT} strokeWidth={2} />
      {axes.map((a, i) => {
        const [x, y] = point(i, n, Math.max(a.value, 0.02) * R);
        return <circle key={a.id} fill={ACCENT} cx={x} cy={y} r={4} />;
      })}
    </svg>
  );
}
