import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
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
  const [route] = useHash();

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <a href="#/" className="text-lg font-semibold tracking-tight">
          Nerdscape
        </a>
        <a href="#/results" className="text-sm underline-offset-4 hover:underline">
          Your map
        </a>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {route === "express" ? (
          <Express {...props} />
        ) : route === "quiz" ? (
          <Quiz {...props} />
        ) : route === "results" ? (
          <Results {...props} />
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
