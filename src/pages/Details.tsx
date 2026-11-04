import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import { gapsByGroup, isChecked, ratingOf, resultOf, skillScore, stats, type Rating } from "../logic.ts";
import { Inline, Markdown } from "../Markdown.tsx";
import type { Concept, GroupFile, Level } from "../schema.ts";

// Why a skill is in the gap list. New stays neutral so a long list of unmet skills
// doesn't read as an alarm.
const ORIGINS = {
  low: { label: "Low score", tag: "bg-rose", stripe: "border-l-rose-edge" },
  heard: { label: "Heard", tag: "bg-butter", stripe: "border-l-butter-edge" },
  new: { label: "New", tag: "bg-muted text-muted-foreground", stripe: "border-l-transparent" },
};
const originOf = (rating: Rating | null) =>
  rating === "new" ? ORIGINS.new : rating === "heard" ? ORIGINS.heard : ORIGINS.low;

const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export const percent = (n: number | null) => (n === null ? "Not rated" : `${Math.round(n * 100)}%`);

// The full gap list, one topic at a time.
export function Gaps({ progress }: AppProps) {
  const gaps = gapsByGroup(GROUPS, progress);
  const [topic, setTopic] = useState("all");
  const shown = gaps.filter((g) => topic === "all" || g.group.group.id === topic);
  return (
    <Page title="Your gaps">
      <TopicChips
        topics={gaps.map((g) => ({ group: g.group, count: g.skills.length }))}
        value={topic}
        onChange={setTopic}
      />
      {gaps.length === 0 && <p className="text-muted-foreground">No gaps yet. Scan or quiz a topic to find some.</p>}
      {shown.map(({ group, skills }) => (
        <div key={group.group.id} className="space-y-2">
          <h2 className="text-lg font-semibold">{group.group.title}</h2>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {skills.map(({ skill, rating, weak, missed }) => {
              const origin = originOf(rating);
              return (
                <li
                  key={skill.id}
                  className={`space-y-2 border-l-4 px-4 py-3 ${weak ? origin.stripe : "border-l-transparent"}`}
                >
                  <p className="[overflow-wrap:anywhere]">
                    <strong>{skill.title}</strong>
                    {weak && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${origin.tag}`}>
                        {origin.label}
                      </span>
                    )}
                    <span className="text-muted-foreground"> · {skill.summary}</span>
                  </p>
                  {missed.map((c) => (
                    <Missed key={c.id} concept={c} seen={progress.answers[c.id]} />
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Page>
  );
}

// Every skill's score, one topic at a time, each opening to its concepts.
export function Skills({ progress }: AppProps) {
  const numbers = stats(GROUPS, progress);
  const [topic, setTopic] = useState("all");
  const shown = GROUPS.filter((g) => topic === "all" || g.group.id === topic);
  return (
    <Page title="Your skills">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Right", numbers.right],
            ["Missed", numbers.missed],
            ["Skills used", numbers.used],
            ["Not rated", numbers.unrated],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border px-4 py-3">
            <dt className="text-xs tracking-widest text-muted-foreground uppercase">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <TopicChips
        topics={GROUPS.map((g) => ({ group: g, count: g.skills.length }))}
        value={topic}
        onChange={setTopic}
      />
      {shown.map((g) => (
        <div key={g.group.id} className="space-y-2">
          <h2 className="text-lg font-semibold">{g.group.title}</h2>
          <ul className="divide-y rounded-lg border">
            {g.skills.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-baseline justify-between gap-x-4 text-left">
                    <span className="font-medium">{s.title}</span>
                    <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground tabular-nums">
                      {percent(skillScore(g, s, progress))}
                      {ratingOf(progress, g, s) && (isChecked(s, progress) ? " · checked" : " · not checked")}
                      <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <p className="text-xs tracking-widest text-muted-foreground uppercase">To explore</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {s.concepts.map((c) => (
                        <li key={c.id} className="[overflow-wrap:anywhere]">
                          <span className="font-medium">{c.title}</span>{" "}
                          <span className="text-muted-foreground">
                            ({LEVEL_LABEL[c.level]}
                            {resultOf(progress, c) && (resultOf(progress, c) === "right" ? ", right" : ", missed")}) ·{" "}
                            <Inline text={c.summary} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Page>
  );
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <a
        href="#/results"
        className="-my-3 inline-block py-3 text-sm text-muted-foreground underline-offset-4 hover:underline sm:my-0 sm:py-0"
      >
        ← Back to your map
      </a>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {children}
    </section>
  );
}

// Filter a long list down to one topic.
function TopicChips(props: {
  topics: { group: GroupFile; count: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const chip = (id: string, label: string, count?: number) => (
    <button
      key={id}
      type="button"
      onClick={() => props.onChange(id)}
      aria-pressed={props.value === id}
      className="rounded-full border px-4 py-2.5 text-sm sm:px-3 sm:py-1 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
    >
      {label}
      {count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">{count}</span>}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip("all", "All")}
      {props.topics.map(({ group, count }) => chip(group.group.id, group.group.title, count))}
    </div>
  );
}

// A missed question in the gap list, expanding to what was asked and why.
function Missed({ concept: c, seen }: { concept: Concept; seen: { variant: number; choice: number } | undefined }) {
  const v = seen && c.variants[seen.variant];
  if (!v) return null;
  return (
    <Collapsible className="rounded-md border-l-4 border-l-rose-edge bg-muted/40 px-3 py-2">
      <CollapsibleTrigger className="group flex w-full items-start justify-between gap-2 text-left text-sm">
        <span className="[overflow-wrap:anywhere]">
          <span className="mr-2 rounded-full bg-rose px-2 py-0.5 text-xs font-medium">
            Missed · {LEVEL_LABEL[c.level]}
          </span>
          <strong>{c.title}</strong>
          <span className="text-muted-foreground">
            {" "}
            · <Inline text={c.summary} />
          </span>
        </span>
        <ChevronDown className="mt-1 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3 text-sm">
        <Markdown text={v.q} />
        <p>
          You picked <Inline text={v.choices[seen.choice]} />. Answer: <Inline text={v.choices[v.answer]} />
        </p>
        <Markdown text={v.explain} />
      </CollapsibleContent>
    </Collapsible>
  );
}
