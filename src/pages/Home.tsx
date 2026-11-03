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
        See every area of software engineering at a glance, or prove what you know. Find out what kind of developer you
        are, and which concepts you haven't met yet.
      </p>
      <div className="mx-auto grid max-w-md gap-3 sm:grid-cols-2">
        <Button size="lg" variant="outline" className="h-auto flex-col gap-1 py-4" asChild>
          <a href="#/scan">
            <span className="text-base">Quick scan</span>
            <span className="text-xs font-normal text-muted-foreground">About 2 min · what you say you know</span>
          </a>
        </Button>
        <Button size="lg" variant="soft" className="h-auto flex-col gap-1 py-4" asChild>
          <a href="#/quiz">
            <span className="text-base">Quiz</span>
            <span className="text-xs font-normal opacity-70">About 5 min · scan, then prove it</span>
          </a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {explored} of {concepts.length} concepts explored · Your answers stay in this browser.
      </p>
    </section>
  );
}
