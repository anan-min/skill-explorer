import { useEffect, useState } from "react";
import type { Progress } from "./logic.ts";
import { Express } from "./pages/Express.tsx";
import { Home } from "./pages/Home.tsx";
import { Quiz } from "./pages/Quiz.tsx";
import { Results } from "./pages/Results.tsx";
import { loadProgress, loadSettings, saveProgress, saveSettings, type Settings } from "./store.ts";

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash.replace(/^#\/?/, "").split("/");
}

export type AppProps = {
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
};

export function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [settings, setSettingsState] = useState(loadSettings);
  useEffect(() => saveProgress(progress), [progress]);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  };
  const props: AppProps = { progress, update: setProgress, settings, setSettings };
  const [route, groupId] = useHash();

  return (
    <>
      <header className="top">
        <a href="#/" className="brand">
          Skill Explorer
        </a>
        <a href="#/results">Your map</a>
      </header>
      <main>
        {route === "express" && groupId ? (
          <Express key={groupId} groupId={groupId} {...props} />
        ) : route === "quiz" && groupId ? (
          <Quiz key={groupId} groupId={groupId} {...props} />
        ) : route === "results" ? (
          <Results {...props} />
        ) : (
          <Home {...props} />
        )}
      </main>
    </>
  );
}
