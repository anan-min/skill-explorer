import type { AppProps } from "../App.tsx";
import { GROUPS } from "../content.ts";
import { conceptsOf, stateOf, visibleGroups } from "../logic.ts";
import { mascot } from "../mascots.ts";

export function Home({ progress, settings, setSettings }: AppProps) {
  return (
    <>
      <section className="intro">
        <h1>Find the concepts you've missed</h1>
        <p>
          Pick a group. <strong>Express</strong> is a quick scan: say what you've heard of. <strong>In-depth</strong> is
          a short quiz. Then look at your map.
        </p>
        <p className="muted">Your answers stay in this browser. Nothing is sent anywhere.</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.frontend}
            onChange={(e) => setSettings({ ...settings, frontend: e.target.checked })}
          />
          I do frontend
        </label>
      </section>
      <ul className="groups">
        {visibleGroups(GROUPS, settings.frontend).map((g) => {
          const concepts = conceptsOf(g);
          const explored = concepts.filter((c) => stateOf(progress, c.id) !== "fog").length;
          const m = mascot(g.group.id);
          return (
            <li key={g.group.id} className="group-card">
              <img src={m.src} alt={`${m.animal} ${m.job}`} width={56} height={56} />
              <div className="grow">
                <h2>{g.group.title}</h2>
                <p className="muted">
                  {explored} of {concepts.length} explored
                </p>
              </div>
              <div className="row">
                <a className="button" href={`#/express/${g.group.id}`}>
                  Express
                </a>
                <a className="button primary" href={`#/quiz/${g.group.id}`}>
                  In-depth
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
