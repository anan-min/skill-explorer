import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AppProps } from "../App.tsx";
import { GROUPS, groupById } from "../content.ts";
import { answer, conceptsOf, pickVariant, scan, scanAnswer, stateOf, type ScanButton } from "../logic.ts";
import { Inline } from "../Markdown.tsx";
import { Question } from "../Question.tsx";
import type { Concept } from "../schema.ts";

const BUTTONS: [ScanButton, string, string][] = [
  ["never", "New", "Never heard of it"],
  ["name", "Heard", "Know the name"],
  ["used", "Used", "Used it"],
];

const scanned = (concepts: Concept[], progress: AppProps["progress"]) =>
  concepts.filter((c) => stateOf(progress, c.id) !== "fog").length;

export function ExpressTopics({ progress }: AppProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Quick scan</h1>
        <p className="text-muted-foreground">
          Pick a topic and go down the list: have you never heard of it, heard the name, or used it?
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {GROUPS.map((g) => {
          const concepts = conceptsOf(g);
          const done = scanned(concepts, progress);
          return (
            <li key={g.group.id}>
              <a href={`#/express/${g.group.id}`} className="block">
                <Card className="transition-colors hover:border-foreground">
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="font-semibold">{g.group.title}</h2>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {done} / {concepts.length}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-foreground"
                        style={{ width: `${concepts.length ? (done / concepts.length) * 100 : 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ExpressTopic({ groupId, progress, update, settings }: AppProps & { groupId: string }) {
  const group = groupById(groupId);
  // The concept whose "Not sure" question is open, with the variant picked for it.
  const [asking, setAsking] = useState<{ id: string; variant: number } | null>(null);
  if (!group) return <NotFound />;

  const concepts = conceptsOf(group);
  const index = GROUPS.indexOf(group);
  const next = GROUPS[index + 1];

  return (
    <section className="space-y-8 pb-24">
      <div className="space-y-1">
        <a href="#/express" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← All topics
        </a>
        <h1 className="text-3xl font-semibold tracking-tight">{group.group.title}</h1>
      </div>

      {group.skills.map((skill) => (
        <div key={skill.id} className="space-y-2">
          <h2 className="text-xs tracking-widest text-muted-foreground uppercase">{skill.title}</h2>
          <ul className="divide-y rounded-lg border">
            {skill.concepts.map((concept) => {
              const state = stateOf(progress, concept.id);
              const notSure = asking?.id === concept.id;
              return (
                <li key={concept.id} className="space-y-3 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-medium">
                        {concept.title}
                        {state === "confirmed" && <span className="ml-2 text-xs text-muted-foreground">✓ quiz</span>}
                      </p>
                      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        <Inline text={concept.summary} />
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={scanAnswer(progress, concept.id) ?? ""}
                        onValueChange={(button) => {
                          if (!button) return;
                          update((p) => scan(p, concept, button as ScanButton));
                          setAsking(null);
                        }}
                        aria-label={`Have you met ${concept.title}?`}
                      >
                        {BUTTONS.map(([button, label, title]) => (
                          <ToggleGroupItem
                            key={button}
                            value={button}
                            title={title}
                            className="px-3 data-[state=on]:bg-foreground data-[state=on]:text-background"
                          >
                            {label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      {concept.variants.length > 0 && (
                        <Button
                          variant={notSure ? "default" : "ghost"}
                          size="sm"
                          title="Not sure: try a question"
                          aria-label={`Not sure about ${concept.title}: try a question`}
                          onClick={() => {
                            const variant = pickVariant(concept, progress, settings.lang, Math.random);
                            setAsking(notSure || variant === null ? null : { id: concept.id, variant });
                          }}
                        >
                          ?
                        </Button>
                      )}
                    </div>
                  </div>
                  {notSure && (
                    <Question
                      concept={concept}
                      variant={asking.variant}
                      onAnswer={(choice) => update((p) => answer(p, concept, asking.variant, choice))}
                      onNext={() => setAsking(null)}
                      nextLabel="Done"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {scanned(concepts, progress)} of {concepts.length} scanned
          </span>
          <Button asChild>
            {next ? <a href={`#/express/${next.group.id}`}>Next topic →</a> : <a href="#/results">See your map →</a>}
          </Button>
        </div>
      </div>
    </section>
  );
}

function NotFound() {
  return (
    <section className="space-y-2 pt-10">
      <h1 className="text-2xl font-semibold">No such topic</h1>
      <a href="#/express" className="underline underline-offset-4">
        Back to the topics
      </a>
    </section>
  );
}
