import { Button } from "@/components/ui/button";
import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import { ratingOf } from "../logic.ts";
import { MASCOT_IDS, mascot } from "../mascots.ts";

export function Home({ progress }: AppProps) {
  const skills = GROUPS.flatMap((g) => g.skills.map((s) => ratingOf(progress, g, s)));
  const rated = skills.filter(Boolean).length;
  return (
    <section className="space-y-8 pt-6 text-center">
      <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
        {MASCOT_IDS.map((id) => (
          <img key={id} className="size-16 rounded-xl bg-white" src={mascot(id).src} alt="" />
        ))}
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">Find the concepts you've missed</h1>
      <p className="mx-auto max-w-lg text-muted-foreground">
        See every area of software engineering at a glance, or prove what you know. Find out what kind of developer you
        are, and which concepts you haven't met yet.
      </p>
      <div className="mx-auto grid max-w-md gap-3 sm:grid-cols-2">
        <Button size="lg" variant="outline" className="h-auto flex-col gap-1 py-4 whitespace-normal" asChild>
          <a href="#/scan">
            <span className="text-base">Quick scan</span>
            <span className="text-xs font-normal text-muted-foreground">About 5 min · 9 easy questions</span>
          </a>
        </Button>
        <Button size="lg" className="h-auto flex-col gap-1 py-4 whitespace-normal" asChild>
          <a href="#/quiz">
            <span className="text-base">Quiz</span>
            <span className="text-xs font-normal opacity-70">About 10 min · up to 18 questions</span>
          </a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {rated} of {skills.length} skills rated · Your answers stay in this browser.
      </p>
    </section>
  );
}
