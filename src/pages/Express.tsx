import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppProps } from "../App.tsx";
import { GROUPS, groupTitleOf } from "../content.ts";
import { answer, expressQueue, pickVariant, scan, stateOf, type ScanButton } from "../logic.ts";
import { Inline } from "../Markdown.tsx";
import { Question } from "../Question.tsx";

const BUTTONS: [ScanButton, string][] = [
  ["never", "Never heard of it"],
  ["name", "Know the name"],
  ["used", "Used it"],
];

export function Express({ progress, update, settings }: AppProps) {
  const [queue, setQueue] = useState(() => expressQueue(GROUPS, progress, Math.random));
  const [index, setIndex] = useState(0);
  const [asking, setAsking] = useState<number | null>(null);

  const concept = queue[index];
  if (!concept) {
    return (
      <section className="space-y-6 pt-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Scan done</h1>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              setQueue(expressQueue(GROUPS, progress, Math.random));
              setIndex(0);
            }}
          >
            Scan more
          </Button>
          <Button variant="outline" asChild>
            <a href="#/quiz">Take the quiz</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="#/results">See your map</a>
          </Button>
        </div>
      </section>
    );
  }

  const next = () => {
    setAsking(null);
    setIndex(index + 1);
  };
  const notSure = pickVariant(concept, progress, settings.lang, Math.random);
  const state = stateOf(progress, concept.id);

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {groupTitleOf(concept.id)} · {index + 1} of {queue.length}
      </p>
      {asking === null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{concept.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              <Inline text={concept.summary} />
            </p>
            {state !== "fog" && <p className="text-sm text-muted-foreground">Already explored: {state}</p>}
            <div className="grid grid-cols-2 gap-2">
              {BUTTONS.map(([button, label]) => (
                <Button
                  key={button}
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    update((p) => scan(p, concept, button));
                    next();
                  }}
                >
                  {label}
                </Button>
              ))}
              {notSure !== null && (
                <Button variant="outline" size="lg" onClick={() => setAsking(notSure)}>
                  Not sure
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Question
          concept={concept}
          variant={asking}
          onAnswer={(choice) => update((p) => answer(p, concept, asking, choice))}
          onNext={next}
        />
      )}
    </section>
  );
}
