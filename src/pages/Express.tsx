import { useState } from "react";
import type { AppProps } from "../App.tsx";
import { groupById } from "../content.ts";
import { answer, conceptsOf, pickVariant, scan, stateOf, type ScanButton } from "../logic.ts";
import { Inline } from "../Markdown.tsx";
import { Question } from "../Question.tsx";

const BUTTONS: [ScanButton, string][] = [
  ["never", "Never heard of it"],
  ["name", "Know the name"],
  ["used", "Used it"],
];

export function Express({ groupId, progress, update, settings }: AppProps & { groupId: string }) {
  const group = groupById(groupId);
  const [index, setIndex] = useState(0);
  const [asking, setAsking] = useState<number | null>(null);
  if (!group) return <NotFound />;

  const concepts = conceptsOf(group);
  const concept = concepts[index];
  if (!concept) {
    return (
      <section className="done">
        <h1>{group.group.title}: scanned</h1>
        <div className="row">
          <a className="button primary" href={`#/quiz/${groupId}`}>
            Check it with a quiz
          </a>
          <a className="button" href="#/results">
            See your map
          </a>
        </div>
      </section>
    );
  }

  const next = () => {
    setAsking(null);
    setIndex(index + 1);
  };
  const notSure = pickVariant(concept, progress, settings.lang, Math.random);

  return (
    <section>
      <p className="muted">
        {group.group.title} · {index + 1} of {concepts.length}
      </p>
      {asking === null ? (
        <div className="card scan">
          <h1>{concept.title}</h1>
          <p>
            <Inline text={concept.summary} />
          </p>
          {stateOf(progress, concept.id) !== "fog" && (
            <p className="muted">Already explored: {stateOf(progress, concept.id)}</p>
          )}
          <div className="scan-buttons">
            {BUTTONS.map(([button, label]) => (
              <button
                key={button}
                onClick={() => {
                  update((p) => scan(p, concept, button));
                  next();
                }}
              >
                {label}
              </button>
            ))}
            {notSure !== null && <button onClick={() => setAsking(notSure)}>Not sure</button>}
          </div>
        </div>
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

export function NotFound() {
  return (
    <section>
      <h1>No such group</h1>
      <a href="#/">Back to the groups</a>
    </section>
  );
}
