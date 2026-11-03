import { ResponsiveRadar, type GridLabelProps } from "@nivo/radar";

type Axis = { id: string; title: string; value: number };

// Paint must end up in SVG attributes (html-to-image drops class-based SVG paint),
// so colours are literals.
const INK = "#171717";
const MUTED = "#737373";
const GRID = "#cfcdc9";

const LINE_CHARS = 12;
const LINE_HEIGHT = 13;

// SVG text doesn't wrap, so long group titles are split into short lines by word.
function wrap(title: string) {
  const lines: string[] = [];
  for (const word of title.toUpperCase().split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= LINE_CHARS) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

// Quiz strength per group, drawn without numbers so it can go on the share card.
export function Radar({ axes }: { axes: Axis[] }) {
  const titles = new Map(axes.map((a) => [a.id, a.title]));
  const Label = ({ id, x, y, anchor }: GridLabelProps) => {
    const lines = wrap(titles.get(id) ?? id);
    const top = y - ((lines.length - 1) * LINE_HEIGHT) / 2;
    return (
      <text
        textAnchor={anchor}
        dominantBaseline="central"
        fill={MUTED}
        fontSize={11}
        fontWeight={500}
        letterSpacing="0.06em"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} y={top + i * LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
  return (
    <div className="aspect-square w-full max-w-md [&_svg]:overflow-visible" role="img" aria-label="Strength per group">
      <ResponsiveRadar
        data={axes.map((a) => ({ group: a.id, strength: Math.max(a.value, 0.02) }))}
        keys={["strength"]}
        indexBy="group"
        maxValue={1}
        margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
        gridShape="linear"
        gridLevels={4}
        gridLabel={Label}
        gridLabelOffset={14}
        curve="linearClosed"
        colors={[INK]}
        fillOpacity={0.08}
        borderWidth={2}
        borderColor={INK}
        dotSize={6}
        dotColor={INK}
        isInteractive={false}
        theme={{ grid: { line: { stroke: GRID, strokeWidth: 1 } } }}
      />
    </div>
  );
}
