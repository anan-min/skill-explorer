import { Button } from "@/components/ui/button";
import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import { conceptsOf, stateOf } from "../logic.ts";
import { MASCOTS, mascot } from "../mascots.ts";

export function Home({ progress }: AppProps) {
  const concepts = GROUPS.flatMap(conceptsOf);
  const explored = concepts.filter((c) => stateOf(progress, c.id) !== "fog").length;
  return (
    <section className="space-y-8 pt-6 text-center">
      <div className="mx-auto flex max-w-md flex-wrap justify-center">
        {Object.keys(MASCOTS).map((id) => (
          <img key={id} className="size-16" src={mascot(id).src} alt="" />
        ))}
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">Find the concepts you've missed</h1>
      <p className="mx-auto max-w-lg text-muted-foreground">
        Scan every area of software engineering, then prove what you claimed. Find out what kind of developer you are,
        and which concepts you haven't met yet.
      </p>
      <div className="space-y-2">
        <Button size="lg" className="h-auto px-10 py-4 text-base" asChild>
          <a href="#/start">Start</a>
        </Button>
        <p className="text-sm text-muted-foreground">
          About 5 minutes: a quick scan of every topic, then a few questions to check.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {explored} of {concepts.length} concepts explored · Your answers stay in this browser.
      </p>
    </section>
  );
}
