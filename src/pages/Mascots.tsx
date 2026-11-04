import { useState } from "react";
import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import { LEAN_RATE, PASS_RATE, WANDERER_AT } from "../logic.ts";
import { DEX, mascot, TOPIC_MASCOTS } from "../mascots.ts";

type Entry = (typeof DEX)[number];

// The drawings have white backgrounds, so `brightness-0` would black out the whole square.
// This filter turns ink and fills into solid black and white into transparent; the card behind stays white.
const SILHOUETTE = "opacity-20 [filter:url(#dex-silhouette)]";
function SilhouetteFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <filter id="dex-silhouette" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 -4 -4 0 11.4" />
      </filter>
    </svg>
  );
}

const title = (id: string) => GROUPS.find((g) => g.group.id === id)?.group.title ?? id;
const number = (e: Entry) => `#${String(DEX.indexOf(e) + 1).padStart(3, "0")}`;
const look = (e: Entry) => mascot(e.animal, e.job);

// How a persona comes out of the results page (see `persona` in logic.ts).
function hint(e: Entry) {
  if (e.key === "wanderer") return `Strong in ${WANDERER_AT} or more topics.`;
  if (e.key === "apprentice")
    return `No topic at ${Math.round(LEAN_RATE * 100)}% yet, or more misses than right answers.`;
  if (e.animal === e.job) return `Strong in ${title(e.animal)} only.`;
  return `Strongest in ${title(e.animal)}, second strongest in ${title(e.job)}.`;
}

// Sections: one per animal (its 9 jobs), then the two solos.
const SECTIONS = [
  ...Object.entries(TOPIC_MASCOTS).map(([id, t]) => ({
    id,
    name: t.animal,
    color: t.color,
    entries: DEX.filter((e) => e.animal === id),
  })),
  { id: "solo", name: "Solo", color: undefined, entries: DEX.filter((e) => !(e.animal in TOPIC_MASCOTS)) },
];

// Every mascot, Pokédex style: found ones in full, the rest as silhouettes with a hint.
export function Mascots({ collection }: AppProps) {
  const [open, setOpen] = useState<string | null>(null);
  const found = new Set(collection);
  const count = DEX.filter((e) => found.has(e.key)).length;
  return (
    <section className="space-y-8">
      <SilhouetteFilter />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Nerd dex</h1>
        <p className="text-muted-foreground">
          Found {count} of {DEX.length}. Your map's nerd joins the dex; quiz again or take another path to find more. A
          topic is strong at {Math.round(PASS_RATE * 100)}% or more, with no more missed answers than right ones.
        </p>
      </div>
      {SECTIONS.map((s) => {
        const selected = s.entries.find((e) => e.key === open);
        return (
          <div key={s.id} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase">
              {s.color && <span className="size-3 rounded-sm" style={{ background: s.color }} />}
              {s.name}
              <span className="font-normal tracking-normal text-muted-foreground tabular-nums">
                {s.entries.filter((e) => found.has(e.key)).length}/{s.entries.length}
              </span>
            </h2>
            <ul className="grid grid-cols-5 gap-2 sm:grid-cols-9 sm:gap-3">
              {s.entries.map((e) => {
                const m = look(e);
                const has = found.has(e.key);
                return (
                  <li key={e.key}>
                    <button
                      type="button"
                      onClick={() => setOpen(open === e.key ? null : e.key)}
                      aria-pressed={open === e.key}
                      aria-label={has ? `${m.animal} ${m.job}` : `Not found yet: ${number(e)}`}
                      className="group w-full rounded-2xl text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="block overflow-hidden rounded-2xl border-2 border-transparent bg-white group-aria-pressed:border-primary">
                        <img
                          src={m.src}
                          alt=""
                          loading="lazy"
                          className={`aspect-square w-full ${has ? "" : SILHOUETTE}`}
                        />
                      </span>
                      <span className="mt-1 block text-[0.7rem] tracking-wider text-muted-foreground uppercase">
                        {has ? m.job : number(e)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selected && <Detail entry={selected} has={found.has(selected.key)} />}
          </div>
        );
      })}
    </section>
  );
}

function Detail({ entry: e, has }: { entry: Entry; has: boolean }) {
  const m = look(e);
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-4 text-center sm:flex-row sm:text-left">
      <span className="shrink-0 overflow-hidden rounded-2xl bg-white">
        <img src={m.src} alt="" className={`size-32 ${has ? "" : SILHOUETTE}`} />
      </span>
      <div className="space-y-1">
        <p className="text-xs tracking-widest text-muted-foreground tabular-nums">{number(e)}</p>
        <p className="text-lg font-semibold tracking-[0.15em] uppercase">{has ? `${m.animal} · ${m.job}` : "???"}</p>
        {has && <p className="text-sm text-muted-foreground italic">{m.tagline}</p>}
        <p className="text-sm">
          <span className="text-muted-foreground">{has ? "Found when: " : "To find it: "}</span>
          {hint(e)}
        </p>
      </div>
    </div>
  );
}
