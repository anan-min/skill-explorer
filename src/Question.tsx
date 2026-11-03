import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { shuffle } from "./logic.ts";
import { Inline, Markdown } from "./Markdown.tsx";
import type { Concept } from "./schema.ts";

const REPO = "https://github.com/anan-min/skill-explorer";

export function reportUrl(conceptId: string, variant: number) {
  return `${REPO}/issues/new?title=${encodeURIComponent(`[report] ${conceptId} #${variant}`)}`;
}

type Props = {
  concept: Concept;
  variant: number;
  onAnswer: (choice: number) => void;
  onNext: () => void;
};

export function Question({ concept, variant, onAnswer, onNext }: Props) {
  const v = concept.variants[variant];
  // Shuffled once per question: drafted questions tend to put the answer in the same slot.
  const order = useMemo(() => shuffle([0, 1, 2, 3], Math.random), [concept.id, variant]);
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (choice: number) => {
    if (picked !== null) return;
    setPicked(choice);
    onAnswer(choice);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between text-sm text-muted-foreground">
        <span>{concept.title}</span>
        {v.lang && <Badge variant="outline">{v.lang === "go" ? "Go" : "TS"}</Badge>}
      </CardHeader>
      <CardContent className="space-y-5">
        <Markdown text={v.q} />
        <ol className="grid gap-2">
          {order.map((i) => {
            const right = picked !== null && i === v.answer;
            const wrong = picked !== null && i === picked && i !== v.answer;
            return (
              <li key={i}>
                <Button
                  variant={right ? "default" : "outline"}
                  className={cn(
                    "h-auto w-full justify-start py-3 text-left whitespace-normal disabled:opacity-100",
                    wrong && "line-through decoration-2",
                    picked !== null && !right && !wrong && "opacity-40 disabled:opacity-40",
                  )}
                  onClick={() => pick(i)}
                  disabled={picked !== null}
                >
                  <span className="[overflow-wrap:anywhere]">
                    <Inline text={v.choices[i]} />
                  </span>
                </Button>
              </li>
            );
          })}
        </ol>
      </CardContent>
      {picked !== null && (
        <CardFooter className="flex-col items-stretch gap-4 border-t pt-5">
          <p className="font-semibold">{picked === v.answer ? "Right." : "Not quite."}</p>
          <Markdown text={v.explain} />
          <div className="flex items-center justify-between gap-2">
            <Button onClick={onNext} autoFocus>
              Next
            </Button>
            <a
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              href={reportUrl(concept.id, variant)}
              target="_blank"
              rel="noreferrer"
            >
              Report this question
            </a>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
