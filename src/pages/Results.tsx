import { toBlob } from "html-to-image";
import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import {
  claimsChecked,
  emptyProgress,
  gapsByGroup,
  gapText,
  isChecked,
  parseBackup,
  persona,
  ratingOf,
  report,
  resultOf,
  skillScore,
  stats,
  strength,
  type Persona,
  type Rating,
} from "../logic.ts";
import type { Concept, Level } from "../schema.ts";
import { Inline, Markdown } from "../Markdown.tsx";
import { mascot } from "../mascots.ts";
import { Radar } from "../Radar.tsx";

function personaMascot(p: Persona) {
  if (p.kind === "locked") return null;
  return p.kind === "group" ? mascot(p.id, p.job) : mascot(p.kind);
}

// Why a skill is in the gap list. New stays neutral so a long list of unmet skills
// doesn't read as an alarm.
const ORIGINS = {
  low: { label: "Low score", tag: "bg-rose", stripe: "border-l-rose-edge" },
  heard: { label: "Heard", tag: "bg-butter", stripe: "border-l-butter-edge" },
  new: { label: "New", tag: "bg-muted text-muted-foreground", stripe: "border-l-transparent" },
};
const originOf = (rating: Rating | null) =>
  rating === "new" ? ORIGINS.new : rating === "heard" ? ORIGINS.heard : ORIGINS.low;

const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

const percent = (n: number | null) => (n === null ? "Not rated" : `${Math.round(n * 100)}%`);

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function Results({ progress, update }: AppProps) {
  const who = persona(GROUPS, progress);
  const { checked, claimed } = claimsChecked(GROUPS, progress);
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
  const downloadReport = () => {
    const name = m && `${m.animal} · ${m.job}`;
    download(new Blob([report(GROUPS, progress, name, m?.tagline)], { type: "text/markdown" }), "nerdscape-report.md");
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

  const startOver = () => {
    if (!window.confirm("Clear every rating and answer in this browser and start over?")) return;
    update(emptyProgress);
    window.location.hash = "#/";
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
              <p className="max-w-sm text-sm text-muted-foreground italic">{m.tagline}</p>
              {claimed > 0 && (
                <p className="text-sm text-muted-foreground">
                  Checked {checked} of {claimed} claimed skills.{checked < claimed && " Take the quiz to check more."}
                </p>
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
            <a href="#/quiz">{checked < claimed ? "Take the quiz" : "Quiz again"}</a>
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
        {gaps.length === 0 && <p className="text-muted-foreground">No gaps yet. Scan or quiz a topic to find some.</p>}
        {gaps.map(({ group, skills }) => (
          <div key={group.group.id} className="space-y-2">
            <h3 className="text-lg font-semibold">{group.group.title}</h3>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {skills.map(({ skill, rating, weak, missed }) => {
                const origin = originOf(rating);
                return (
                  <li
                    key={skill.id}
                    className={`space-y-2 border-l-4 px-4 py-3 ${weak ? origin.stripe : "border-l-transparent"}`}
                  >
                    <p className="[overflow-wrap:anywhere]">
                      <strong>{skill.title}</strong>
                      {weak && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${origin.tag}`}
                        >
                          {origin.label}
                        </span>
                      )}
                      <span className="text-muted-foreground"> · {skill.summary}</span>
                    </p>
                    {missed.map((c) => (
                      <Missed key={c.id} concept={c} seen={progress.answers[c.id]} />
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Your skills</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Right", numbers.right],
              ["Missed", numbers.missed],
              ["Skills used", numbers.used],
              ["Not rated", numbers.unrated],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border px-4 py-3">
              <dt className="text-xs tracking-widest text-muted-foreground uppercase">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {GROUPS.map((g) => (
          <div key={g.group.id} className="space-y-2">
            <h3 className="text-lg font-semibold">{g.group.title}</h3>
            <ul className="divide-y rounded-lg border">
              {g.skills.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <Collapsible>
                    <CollapsibleTrigger className="group flex w-full items-baseline justify-between gap-x-4 text-left">
                      <span className="font-medium">{s.title}</span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground tabular-nums">
                        {percent(skillScore(g, s, progress))}
                        {ratingOf(progress, g, s) && (isChecked(s, progress) ? " · checked" : " · not checked")}
                        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <p className="text-xs tracking-widest text-muted-foreground uppercase">To explore</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {s.concepts.map((c) => (
                          <li key={c.id} className="[overflow-wrap:anywhere]">
                            <span className="font-medium">{c.title}</span>{" "}
                            <span className="text-muted-foreground">
                              ({LEVEL_LABEL[c.level]}
                              {resultOf(progress, c) && (resultOf(progress, c) === "right" ? ", right" : ", missed")}) ·{" "}
                              <Inline text={c.summary} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <footer className="flex flex-wrap gap-2 border-t pt-6">
        <Button variant="outline" onClick={copyGaps} disabled={!gaps.length}>
          Copy gap list
        </Button>
        <Button variant="outline" onClick={downloadReport}>
          Download report
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
        <Button variant="outline" className="sm:ml-auto" onClick={startOver}>
          Start over
        </Button>
      </footer>
    </div>
  );
}

// A missed question in the gap list, expanding to what was asked and why.
function Missed({ concept: c, seen }: { concept: Concept; seen: { variant: number; choice: number } | undefined }) {
  const v = seen && c.variants[seen.variant];
  if (!v) return null;
  return (
    <Collapsible className="rounded-md border-l-4 border-l-rose-edge bg-muted/40 px-3 py-2">
      <CollapsibleTrigger className="group flex w-full items-start justify-between gap-2 text-left text-sm">
        <span className="[overflow-wrap:anywhere]">
          <span className="mr-2 rounded-full bg-rose px-2 py-0.5 text-xs font-medium">
            Missed · {LEVEL_LABEL[c.level]}
          </span>
          <strong>{c.title}</strong>
          <span className="text-muted-foreground">
            {" "}
            · <Inline text={c.summary} />
          </span>
        </span>
        <ChevronDown className="mt-1 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3 text-sm">
        <Markdown text={v.q} />
        <p>
          You picked <Inline text={v.choices[seen.choice]} />. Answer: <Inline text={v.choices[v.answer]} />
        </p>
        <Markdown text={v.explain} />
      </CollapsibleContent>
    </Collapsible>
  );
}
