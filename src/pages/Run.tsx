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

const BUTTONS: [ScanButton, string, string][] = [
  ["never", "New", "Never heard of it"],
  ["name", "Heard", "Know the name"],
  ["used", "Used", "Used it"],
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
  const finished = queue !== null && index >= queue.length;
  useEffect(() => {
    if (finished) window.location.hash = "#/results";
  }, [finished]);

  if (queue === null) {
    const rows = sample.flatMap((s) => s.concepts);
    const done = rows.filter((c) => stateOf(progress, c.id) !== "fog").length;
    return (
      <section className="space-y-8 pb-24">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{mode === "quiz" ? "Step 1 of 2 · Quick scan" : "Quick scan"}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Have you met these?</h1>
          <p className="text-muted-foreground">
            A few from every topic. Never heard of it, heard the name, or used it?
          </p>
        </div>
        {sample.map(({ group, concepts }) => (
          <div key={group.group.id} className="space-y-2">
            <h2 className="text-xs tracking-widest text-muted-foreground uppercase">{group.group.title}</h2>
            <ul className="divide-y rounded-lg border">
              {concepts.map((concept) => (
                <ScanRow
                  key={concept.id}
                  concept={concept}
                  value={scanAnswer(progress, concept.id)}
                  confirmed={stateOf(progress, concept.id) === "confirmed"}
                  onPick={(button) => update((p) => scan(p, concept, button))}
                />
              ))}
            </ul>
          </div>
        ))}
        <StickyBar>
          <span className="text-sm text-muted-foreground tabular-nums">
            {done} of {rows.length} answered
          </span>
          <Button
            disabled={done < rows.length}
            onClick={() =>
              mode === "quiz" ? setQueue(checks(progress, settings.lang)) : (window.location.hash = "#/results")
            }
          >
            {mode === "quiz" ? "Next: quick check →" : "See my result →"}
          </Button>
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
  concept: Concept;
  value: ScanButton | null;
  confirmed: boolean;
  onPick: (button: ScanButton) => void;
};

function ScanRow({ concept, value, confirmed, onPick }: RowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
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
        {BUTTONS.map(([button, label, title]) => (
          <ToggleGroupItem key={button} value={button} title={title} className={`px-3 ${selected}`}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </li>
  );
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">{children}</div>
    </div>
  );
}
