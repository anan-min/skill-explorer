import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AppProps } from "../App.tsx";
import { GROUPS, groupTitleOf } from "../content.ts";
import {
  answer,
  checkQueue,
  pickVariant,
  scan,
  scanAnswer,
  scanSample,
  stateOf,
  type LangPref,
  type Progress,
  type ScanButton,
} from "../logic.ts";
import { Inline } from "../Markdown.tsx";
import { Question } from "../Question.tsx";
import type { Concept } from "../schema.ts";

// The last field is the pastel shown once the button is picked.
const BUTTONS: [ScanButton, string, string, string][] = [
  ["never", "New", "Never heard of it", "data-[state=on]:bg-rose data-[state=on]:border-rose-edge"],
  ["name", "Heard", "Know the name", "data-[state=on]:bg-butter data-[state=on]:border-butter-edge"],
  ["used", "Used", "Used it", "data-[state=on]:bg-sage data-[state=on]:border-sage-edge"],
];

const LANGS: [LangPref, string][] = [
  ["go", "Go"],
  ["ts", "TS"],
  ["both", "Both"],
];

const selected = "data-[state=on]:bg-foreground data-[state=on]:text-background";

function checks(progress: Progress, lang: LangPref) {
  return checkQueue(GROUPS, progress, lang, Math.random).map((concept) => ({
    concept,
    variant: pickVariant(concept, progress, lang, Math.random)!,
  }));
}

// Quick scan: a sample of every topic. Quiz: the same scan, then check the claims (or a basic question) in each.
export function Run({ mode, progress, update, settings, setSettings }: AppProps & { mode: "scan" | "quiz" }) {
  const [sample] = useState(() => scanSample(GROUPS, progress, Math.random));
  const [queue, setQueue] = useState<ReturnType<typeof checks> | null>(null);
  const [index, setIndex] = useState(0);
  // The scan shows one topic per page.
  const [page, setPage] = useState(0);
  const finished = queue !== null && index >= queue.length;
  useEffect(() => {
    if (finished) window.location.hash = "#/results";
  }, [finished]);

  if (queue === null) {
    const { group, concepts } = sample[page];
    const last = page === sample.length - 1;
    const done = concepts.filter((c) => stateOf(progress, c.id) !== "fog").length;
    // Keep the topic's own skill order, showing only skills with a row in this sample.
    const skills = group.skills
      .map((skill) => ({ skill, rows: concepts.filter((c) => skill.concepts.includes(c)) }))
      .filter((s) => s.rows.length);
    const go = (to: number) => {
      setPage(to);
      window.scrollTo(0, 0);
    };
    // Fills row by row; in a quiz the scan is the first half of the bar.
    const scanned = (page + done / concepts.length) / sample.length;
    return (
      <section className="space-y-5 pb-24">
        <ProgressBar value={mode === "quiz" ? scanned / 2 : scanned} />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {mode === "quiz" ? "Step 1 of 2 · " : ""}Quick scan · Topic {page + 1} of {sample.length}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{group.group.title}</h1>
          <p className="hidden text-muted-foreground sm:block">Never heard of it, heard the name, or used it?</p>
        </div>
        <ul className="divide-y rounded-lg border">
          {skills.flatMap(({ skill, rows }) =>
            rows.map((concept) => (
              <ScanRow
                key={concept.id}
                skill={skill.title}
                concept={concept}
                value={scanAnswer(progress, concept.id)}
                confirmed={stateOf(progress, concept.id) === "confirmed"}
                onPick={(button) => update((p) => scan(p, concept, button))}
              />
            )),
          )}
        </ul>
        <StickyBar>
          <span className="text-sm text-muted-foreground tabular-nums">
            {done} of {concepts.length} answered
          </span>
          <div className="flex gap-2">
            {page > 0 && (
              <Button variant="outline" onClick={() => go(page - 1)}>
                ← Back
              </Button>
            )}
            <Button
              disabled={done < concepts.length}
              onClick={() =>
                !last
                  ? go(page + 1)
                  : mode === "quiz"
                    ? setQueue(checks(progress, settings.lang))
                    : (window.location.hash = "#/results")
              }
            >
              {!last ? "Next topic →" : mode === "quiz" ? "Next: quick check →" : "See my result →"}
            </Button>
          </div>
        </StickyBar>
      </section>
    );
  }

  const current = queue[index];
  if (!current) return null;

  const setLang = (lang: LangPref) => {
    setSettings({ ...settings, lang });
    setQueue(checks(progress, lang));
    setIndex(0);
  };

  return (
    <section className="space-y-4">
      <ProgressBar value={0.5 + index / queue.length / 2} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Step 2 of 2 · Check {index + 1} of {queue.length} · {groupTitleOf(current.concept.id)}
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={settings.lang}
          onValueChange={(lang) => lang && setLang(lang as LangPref)}
          aria-label="Language"
        >
          {LANGS.map(([lang, label]) => (
            <ToggleGroupItem key={lang} value={lang} className={`px-4 ${selected}`}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Question
        key={index}
        concept={current.concept}
        variant={current.variant}
        onAnswer={(choice) => update((p) => answer(p, current.concept, current.variant, choice))}
        onNext={() => setIndex(index + 1)}
        nextLabel={index + 1 < queue.length ? "Next" : "See my result"}
      />
    </section>
  );
}

type RowProps = {
  skill: string;
  concept: Concept;
  value: ScanButton | null;
  confirmed: boolean;
  onPick: (button: ScanButton) => void;
};

function ScanRow({ skill, concept, value, confirmed, onPick }: RowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[0.7rem] tracking-widest text-muted-foreground uppercase">{skill}</p>
        <p className="font-medium">
          {concept.title}
          {confirmed && <span className="ml-2 text-xs text-muted-foreground">✓ quiz</span>}
        </p>
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <Inline text={concept.summary} />
        </p>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value ?? ""}
        onValueChange={(button) => button && onPick(button as ScanButton)}
        aria-label={`Have you met ${concept.title}?`}
      >
        {BUTTONS.map(([button, label, title, tint]) => (
          <ToggleGroupItem key={button} value={button} title={title} className={`px-3 ${tint}`}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </li>
  );
}

// Overall progress through the run, pinned to the top edge; no number, the header says where you are.
function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-10 h-1 bg-border"
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <div className="h-full bg-foreground transition-[width] duration-300" style={{ width: `${value * 100}%` }} />
    </div>
  );
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">{children}</div>
    </div>
  );
}
