import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AppProps } from "../App.tsx";
import { GROUPS, groupTitleOf } from "../content.ts";
import { answer, pickVariant, quizQueue, type LangPref, type Progress } from "../logic.ts";
import { Question } from "../Question.tsx";

const LANGS: [LangPref, string][] = [
  ["go", "Go"],
  ["ts", "TS"],
  ["both", "Both"],
];

function newSession(progress: Progress, lang: LangPref) {
  return quizQueue(GROUPS, progress, lang, Math.random).map((concept) => ({
    concept,
    variant: pickVariant(concept, progress, lang, Math.random)!,
  }));
}

export function Quiz({ progress, update, settings, setSettings }: AppProps) {
  const [session, setSession] = useState(() => newSession(progress, settings.lang));
  const [index, setIndex] = useState(0);

  const setLang = (lang: LangPref) => {
    setSettings({ ...settings, lang });
    setSession(newSession(progress, lang));
    setIndex(0);
  };
  const restart = () => {
    setSession(newSession(progress, settings.lang));
    setIndex(0);
  };
  const current = session[index];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {current ? `${groupTitleOf(current.concept.id)} · ${index + 1} of ${session.length}` : "Quiz"}
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={settings.lang}
          onValueChange={(lang) => lang && setLang(lang as LangPref)}
          aria-label="Language"
        >
          {LANGS.map(([lang, label]) => (
            <ToggleGroupItem
              key={lang}
              value={lang}
              className="px-4 data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {current ? (
        <Question
          key={index}
          concept={current.concept}
          variant={current.variant}
          onAnswer={(choice) => update((p) => answer(p, current.concept, current.variant, choice))}
          onNext={() => setIndex(index + 1)}
        />
      ) : (
        <div className="space-y-6 pt-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            {session.length ? "Session done" : "Nothing left to quiz here"}
          </h1>
          <div className="flex justify-center gap-2">
            {session.length > 0 && <Button onClick={restart}>Another round</Button>}
            <Button variant="outline" asChild>
              <a href="#/results">See your map</a>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
