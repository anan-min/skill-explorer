import { useMemo, useState } from "react";
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
    <div className="question">
      <div className="q-meta">
        <span>{concept.title}</span>
        {v.lang && <span className="lang">{v.lang === "go" ? "Go" : "TS"}</span>}
      </div>
      <Markdown text={v.q} />
      <ol className="choices">
        {order.map((i) => {
          const state = picked === null ? "" : i === v.answer ? "right" : i === picked ? "wrong" : "dim";
          return (
            <li key={i}>
              <button className={`choice ${state}`} onClick={() => pick(i)} disabled={picked !== null}>
                <Inline text={v.choices[i]} />
              </button>
            </li>
          );
        })}
      </ol>
      {picked !== null && (
        <div className="feedback">
          <strong>{picked === v.answer ? "Right." : "Not quite."}</strong>
          <Markdown text={v.explain} />
          <div className="row">
            <button className="primary" onClick={onNext} autoFocus>
              Next
            </button>
            <a className="report" href={reportUrl(concept.id, variant)} target="_blank" rel="noreferrer">
              Report this question
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
