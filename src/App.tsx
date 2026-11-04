import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import type { Progress } from "./logic.ts";
import { Gaps, Skills } from "./pages/Details.tsx";
import { Home } from "./pages/Home.tsx";
import { Mascots } from "./pages/Mascots.tsx";
import { Results } from "./pages/Results.tsx";
import { Run } from "./pages/Run.tsx";
import {
  loadCollection,
  loadProgress,
  loadSettings,
  saveCollection,
  saveProgress,
  saveSettings,
  type Settings,
} from "./store.ts";

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
  collection: string[];
  setCollection: (keys: string[]) => void;
};

export function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [settings, setSettingsState] = useState(loadSettings);
  const [collection, setCollection] = useState(loadCollection);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveCollection(collection), [collection]);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  };
  const props: AppProps = { progress, update: setProgress, settings, setSettings, collection, setCollection };
  const [route] = useHash();
  const running = route === "scan" || route === "quiz";

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <a href="#/" className="text-lg font-semibold tracking-tight">
          Nerdscape
        </a>
        {/* Hidden mid-run: leaving drops the run's queue. "Your map" waits for a finished scan or quiz. */}
        {!running && (
          <nav className="flex gap-4 text-sm">
            <a href="#/mascots" className="underline-offset-4 hover:underline">
              Mascots
            </a>
            {progress.finished && (
              <a href="#/results" className="underline-offset-4 hover:underline">
                Your map
              </a>
            )}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {running ? (
          <Run key={route} mode={route} {...props} />
        ) : route === "results" ? (
          <Results {...props} />
        ) : route === "gaps" ? (
          <Gaps {...props} />
        ) : route === "skills" ? (
          <Skills {...props} />
        ) : route === "mascots" ? (
          <Mascots {...props} />
        ) : (
          <Home {...props} />
        )}
      </main>
      <footer className="mx-auto flex max-w-3xl flex-wrap justify-between gap-2 border-t px-4 py-6 text-sm text-muted-foreground">
        <span>
          Made by{" "}
          <a className="text-foreground underline-offset-4 hover:underline" href="https://github.com/anan-min">
            anan-min
          </a>
        </span>
        <a
          className="text-foreground underline-offset-4 hover:underline"
          href="https://github.com/anan-min/skill-explorer"
        >
          Source on GitHub
        </a>
      </footer>
      <Toaster position="bottom-center" />
    </div>
  );
}
