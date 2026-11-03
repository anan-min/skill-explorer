import { toBlob } from "html-to-image";
import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import { allChecked, gapsByGroup, gapText, parseBackup, persona, stats, strength, type Persona } from "../logic.ts";
import { Inline, Markdown } from "../Markdown.tsx";
import { mascot } from "../mascots.ts";
import { Radar } from "../Radar.tsx";

function personaMascot(p: Persona) {
  if (p.kind === "locked") return null;
  return mascot(p.kind === "group" ? p.id : p.kind);
}

// Where a gap came from. New stays neutral so a long list of unmet concepts
// doesn't read as an alarm.
const ORIGINS = {
  missed: { label: "Missed", tag: "bg-rose", stripe: "border-l-rose-edge" },
  heard: { label: "Heard", tag: "bg-butter", stripe: "border-l-butter-edge" },
  new: { label: "New", tag: "bg-muted text-muted-foreground", stripe: "border-l-transparent" },
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function Results({ progress, update }: AppProps) {
  const who = persona(GROUPS, progress);
  const checked = allChecked(GROUPS, progress);
  const m = personaMascot(who);
  const hero = useRef<HTMLDivElement>(null);

  const card = async () => {
    const blob = await toBlob(hero.current!, { pixelRatio: 2 });
    if (!blob) throw new Error("Could not render the card");
    return blob;
  };
  const canShare = typeof navigator.canShare === "function";

  const copyImage = async () => {
    try {
      // Pass the promise straight in: Safari drops the user gesture across an await.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": card() })]);
      toast("Image copied");
    } catch {
      toast("Couldn't copy the image here; try Download");
    }
  };
  const share = async () => {
    try {
      await navigator.share({ files: [new File([await card()], "nerdscape.png", { type: "image/png" })] });
    } catch {
      // Cancelled or unsupported.
    }
  };
  const copyGaps = async () => {
    try {
      await navigator.clipboard.writeText(gapText(GROUPS, progress));
      toast("Gap list copied");
    } catch {
      toast("Couldn't copy here");
    }
  };
  const backup = () =>
    download(new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" }), "nerdscape-backup.json");
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const restored = parseBackup(await file.text());
      update(() => restored);
      toast("Restored");
    } catch {
      toast("That file isn't a Nerdscape backup");
    }
  };

  const gaps = gapsByGroup(GROUPS, progress);
  const numbers = stats(GROUPS, progress);

  return (
    <div className="space-y-10">
      <section className="flex flex-col items-center gap-4">
        <div
          ref={hero}
          className="flex w-full max-w-lg flex-col items-center gap-1 bg-background px-6 py-8 text-center"
        >
          {m ? (
            <>
              <img className="mascot size-44" src={m.src} alt="" />
              <p className="text-2xl font-semibold tracking-[0.25em] uppercase">{m.animal}</p>
              <p className="text-sm tracking-[0.2em] text-muted-foreground uppercase">{m.job}</p>
              {who.kind === "wanderer" && <p className="text-sm text-muted-foreground">Strong in every area.</p>}
              {who.kind === "apprentice" && (
                <p className="text-sm text-muted-foreground">Every area is still open to explore.</p>
              )}
              {m && !checked && (
                <p className="text-sm text-muted-foreground">Based on what you said. Take the quiz to check it.</p>
              )}
            </>
          ) : (
            <>
              <img className="mascot size-44 opacity-30 grayscale" src={mascot("wanderer").src} alt="" />
              <p className="text-2xl font-semibold tracking-[0.25em] uppercase">Keep exploring</p>
              <p className="text-sm text-muted-foreground">Finish a quick scan or a quiz to meet your mascot.</p>
            </>
          )}
          <Radar axes={GROUPS.map((g) => ({ id: g.group.id, title: g.group.title, value: strength(g, progress) }))} />
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Nerdscape</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="soft" asChild>
            <a href="#/quiz">{checked ? "Quiz again" : "Take the quiz"}</a>
          </Button>
          <Button variant="outline" onClick={copyImage}>
            Copy image
          </Button>
          <Button variant="outline" onClick={async () => download(await card(), "nerdscape.png")}>
            Download
          </Button>
          {canShare && (
            <Button variant="outline" onClick={share}>
              Share
            </Button>
          )}
        </div>
      </section>

      <Separator />

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">Your gaps</h2>
        {gaps.length === 0 && <p className="text-muted-foreground">No gaps yet. Scan or quiz a group to find some.</p>}
        {gaps.map(({ group, skills }) => (
          <div key={group.group.id} className="space-y-3">
            <h3 className="text-lg font-semibold">{group.group.title}</h3>
            {skills.map(({ skill, gaps }) => (
              <div key={skill.id} className="space-y-1">
                <h4 className="text-xs tracking-widest text-muted-foreground uppercase">{skill.title}</h4>
                <ul className="divide-y overflow-hidden rounded-lg border">
                  {gaps.map((c) => {
                    const { seen, scan } = progress.concepts[c.id] ?? {};
                    const v = seen && c.variants[seen.variant];
                    const origin = seen ? ORIGINS.missed : scan === "name" ? ORIGINS.heard : ORIGINS.new;
                    const label = (
                      <span className="[overflow-wrap:anywhere]">
                        <strong>{c.title}</strong>
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${origin.tag}`}
                        >
                          {origin.label}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · <Inline text={c.summary} />
                        </span>
                      </span>
                    );
                    return (
                      <li key={c.id} className={`border-l-4 px-4 py-3 ${origin.stripe}`}>
                        {v ? (
                          <Collapsible>
                            <CollapsibleTrigger className="group flex w-full items-start justify-between gap-2 text-left">
                              {label}
                              <ChevronDown className="mt-1 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-3 pt-3 text-sm">
                              <Markdown text={v.q} />
                              <p>
                                You picked <Inline text={v.choices[seen.choice]} />. Answer:{" "}
                                <Inline text={v.choices[v.answer]} />
                              </p>
                              <Markdown text={v.explain} />
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          label
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Your numbers</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Correct", numbers.correct],
              ["Wrong", numbers.wrong],
              ["Used it", numbers.used],
              ["Not explored", numbers.unexplored],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border px-4 py-3">
              <dt className="text-xs tracking-widest text-muted-foreground uppercase">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="divide-y rounded-lg border">
          {numbers.groups.map((g) => (
            <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
              <span className="font-medium">{g.title}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {g.correct} of {g.answered} correct · {g.explored} of {g.total} explored
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap gap-2 border-t pt-6">
        <Button variant="outline" onClick={copyGaps} disabled={!gaps.length}>
          Copy gap list
        </Button>
        <Button variant="outline" onClick={backup}>
          Backup
        </Button>
        <Button variant="outline" asChild>
          <label>
            Restore
            <input type="file" accept="application/json" hidden onChange={(e) => void restore(e.target.files?.[0])} />
          </label>
        </Button>
      </footer>
    </div>
  );
}
