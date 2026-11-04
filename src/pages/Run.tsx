import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AppProps } from "../App.tsx";
import { GROUPS, groupTitleOf } from "../content.ts";
import {
  answer,
  finishRun,
  quickChecks,
  quizChecks,
  rate,
  ratingOf,
  type Check,
  type LangPref,
  type Progress,
  type Rating,
} from "../logic.ts";
import { Question } from "../Question.tsx";
import { LANG_LABELS, type Skill } from "../schema.ts";

const BUTTONS: [Rating, string, string][] = [
  ["new", "New", "Never heard of it"],
  ["heard", "Heard", "Know the name"],
  ["used", "Used", "Used it"],
];

const LANGS: [LangPref, string][] = [
  ...Object.entries(LANG_LABELS).map(([lang, label]) => [lang as LangPref, label] as [LangPref, string]),
];

const selected = "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

const checks = (mode: "scan" | "quiz", progress: Progress, lang: LangPref): Check[] =>
  (mode === "quiz" ? quizChecks : quickChecks)(GROUPS, progress, lang, Math.random);

// Both modes rate every skill, one topic per page, then ask questions:
// Quick scan one easy question per topic, Quiz more and harder ones on what you claimed.
export function Run({ mode, progress, update, settings, setSettings }: AppProps & { mode: "scan" | "quiz" }) {
  const [queue, setQueue] = useState<Check[] | null>(null);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(0);
  const finished = queue !== null && index >= queue.length;
  useEffect(() => {
    if (!finished) return;
    update(finishRun);
    window.location.hash = "#/results";
  }, [finished, update]);

  if (queue === null) {
    const group = GROUPS[page];
    const last = page === GROUPS.length - 1;
    const done = group.skills.filter((s) => ratingOf(progress, group, s)).length;
    const go = (to: number) => {
      setPage(to);
      window.scrollTo(0, 0);
    };
    // Fills row by row; the rating step is the first half of the bar.
    const rated = (page + done / group.skills.length) / GROUPS.length;
    return (
      <section className="space-y-5 pb-24">
        <ProgressBar value={rated / 2} />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Step 1 of 2 · {mode === "quiz" ? "Quiz" : "Quick scan"} · Topic {page + 1} of {GROUPS.length}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{group.group.title}</h1>
          <p className="hidden text-muted-foreground sm:block">Never heard of it, heard the name, or used it?</p>
        </div>
        <ul className="divide-y rounded-lg border">
          {group.skills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              value={ratingOf(progress, group, skill)}
              onPick={(rating) => update((p) => rate(p, group, skill, rating))}
            />
          ))}
        </ul>
        <StickyBar>
          <span className="text-sm text-muted-foreground tabular-nums">
            {done} of {group.skills.length} answered
          </span>
          <div className="flex gap-2">
            {page > 0 && (
              <Button variant="outline" onClick={() => go(page - 1)}>
                ← Back
              </Button>
            )}
            <Button
              disabled={done < group.skills.length}
              onClick={() => (!last ? go(page + 1) : setQueue(checks(mode, progress, settings.lang)))}
            >
              {!last ? "Next topic →" : "Next: questions →"}
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
    setQueue(checks(mode, progress, lang));
    setIndex(0);
  };

  return (
    <section className="space-y-4">
      <ProgressBar value={0.5 + index / queue.length / 2} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Step 2 of 2 · Question {index + 1} of {queue.length} · {groupTitleOf(current.concept.id)}
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

type RowProps = { skill: Skill; value: Rating | null; onPick: (rating: Rating) => void };

function SkillRow({ skill, value, onPick }: RowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5">
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-medium">{skill.title}</p>
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{skill.summary}</p>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value ?? ""}
        onValueChange={(rating) => rating && onPick(rating as Rating)}
        aria-label={`Have you worked with ${skill.title}?`}
      >
        {BUTTONS.map(([rating, label, title]) => (
          <ToggleGroupItem key={rating} value={rating} title={title} className={`px-3 ${selected}`}>
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
      <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${value * 100}%` }} />
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
