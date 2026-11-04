import { toBlob } from "html-to-image";
import { Copy, ImageDown, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import {
  claimsChecked,
  emptyProgress,
  gapsByGroup,
  gapText,
  persona,
  report,
  skillScore,
  stats,
  strength,
  type Persona,
} from "../logic.ts";
import { DEX, dexKey, mascot } from "../mascots.ts";
import { Radar } from "../Radar.tsx";
import { percent } from "./Details.tsx";

// A skill counts as strong in the summary from this score, the same bar a topic needs to pass.
const STRONG = 0.6;

function personaMascot(p: Persona) {
  if (p.kind === "locked") return null;
  return p.kind === "group" ? mascot(p.id, p.job) : mascot(p.kind);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function Results({ progress, update, collection, setCollection }: AppProps) {
  const who = persona(GROUPS, progress);
  const { checked, claimed } = claimsChecked(GROUPS, progress);
  const m = personaMascot(who);
  const hero = useRef<HTMLDivElement>(null);
  // Seeing a mascot on your map adds it to the dex.
  const found = dexKey(who);
  useEffect(() => {
    if (found && !collection.includes(found)) setCollection([...collection, found]);
  }, [found, collection, setCollection]);

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
  const startOver = () => {
    if (!window.confirm("Clear every rating and answer in this browser and start over?")) return;
    if (window.confirm("Also clear the nerds you've found? Cancel keeps them.")) setCollection([]);
    update(emptyProgress);
    window.location.hash = "#/";
  };

  const gaps = gapsByGroup(GROUPS, progress);
  const numbers = stats(GROUPS, progress);
  const gapSkills = gaps.reduce((n, g) => n + g.skills.length, 0);
  // Rated skills by score, for the summary's strongest and weakest three.
  const rated = GROUPS.flatMap((g) => g.skills.map((s) => ({ title: s.title, score: skillScore(g, s, progress) })))
    .filter((r): r is { title: string; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score);
  const strongCount = rated.filter((r) => r.score >= STRONG).length;
  const strongest = rated.slice(0, 3);
  const weakest = rated.slice(Math.max(3, rated.length - 3)).reverse();

  return (
    <div className="space-y-10">
      <section className="flex flex-col items-center gap-4">
        <div
          ref={hero}
          className="flex w-full max-w-lg flex-col items-center gap-1 bg-background px-6 py-8 text-center"
        >
          {m ? (
            <>
              <img className="mascot size-44 rounded-3xl bg-white" src={m.src} alt="" />
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
              <img
                className="mascot size-44 rounded-3xl bg-white opacity-30 grayscale"
                src={mascot("wanderer").src}
                alt=""
              />
              <p className="text-2xl font-semibold tracking-[0.25em] uppercase">Keep exploring</p>
              <p className="text-sm text-muted-foreground">Finish a quick scan or a quiz to meet your nerd.</p>
            </>
          )}
          <Radar
            color={m?.color}
            axes={GROUPS.map((g) => ({ id: g.group.id, title: g.group.title, value: strength(g, progress) }))}
          />
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Nerdscape</p>
        </div>
        {/* Sharing the card is the point of this page, so it gets the first, filled button and icons. */}
        <div className="flex flex-wrap justify-center gap-2">
          {canShare && (
            <Button onClick={share}>
              <Share2 />
              Share your nerd
            </Button>
          )}
          <Button variant={canShare ? "outline" : "default"} onClick={copyImage}>
            <Copy />
            Copy image
          </Button>
          <Button variant="outline" onClick={async () => download(await card(), "nerdscape.png")}>
            <ImageDown />
            Save image
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild>
            <a href="#/quiz">{checked < claimed ? "Take the quiz →" : "Quiz again →"}</a>
          </Button>
          <Button variant="ghost" onClick={startOver}>
            <RotateCcw />
            Start over
          </Button>
        </div>
        <a
          href="#/mascots"
          className="-my-3 inline-block py-3 text-sm sm:my-0 sm:py-0 text-muted-foreground underline-offset-4 hover:underline"
        >
          Nerd dex · {collection.length} of {DEX.length} found
        </a>
      </section>

      <Separator />

      <section className="grid gap-4 sm:grid-cols-2">
        <Summary
          title="Your gaps"
          headline={`${gapSkills} skills to work on · ${numbers.missed} missed questions`}
          href="#/gaps"
          link="See all gaps"
          rows={gaps.slice(0, 3).map((g) => [g.group.group.title, `${g.skills.length} skills`])}
          empty="No gaps yet."
        />
        <Summary
          title="Your skills"
          headline={`${strongCount} of ${rated.length} strong · ${checked} checked`}
          href="#/skills"
          link="See all skills"
          rows={[
            ...strongest.map((r): [string, string] => [r.title, percent(r.score)]),
            ...weakest.map((r): [string, string] => [r.title, percent(r.score)]),
          ]}
          empty="Rate some skills to see them here."
        />
      </section>

      <footer className="flex flex-wrap gap-2 border-t pt-6">
        <Button variant="outline" onClick={copyGaps} disabled={!gaps.length}>
          Copy gap list
        </Button>
        <Button variant="outline" onClick={downloadReport}>
          Download report
        </Button>
      </footer>
    </div>
  );
}

// A short look at a list that has its own page.
function Summary(props: {
  title: string;
  headline: string;
  href: string;
  link: string;
  rows: [string, string][];
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-5">
      <h2 className="text-xl font-semibold tracking-tight">{props.title}</h2>
      <p className="text-sm text-muted-foreground">{props.headline}</p>
      {props.rows.length ? (
        <ul className="divide-y text-sm">
          {props.rows.map(([label, value]) => (
            <li key={label} className="flex justify-between gap-4 py-1.5">
              <span className="[overflow-wrap:anywhere]">{label}</span>
              <span className="text-muted-foreground tabular-nums">{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{props.empty}</p>
      )}
      <Button variant="outline" className="mt-auto self-start" asChild>
        <a href={props.href}>{props.link} →</a>
      </Button>
    </div>
  );
}
