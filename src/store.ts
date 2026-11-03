import { emptyProgress, parseBackup, type LangPref, type Progress } from './logic.ts'

const PROGRESS_KEY = 'skill-explorer:progress'
const SETTINGS_KEY = 'skill-explorer:settings'

export type Settings = { frontend: boolean; lang: LangPref }
const defaultSettings: Settings = { frontend: false, lang: 'both' }

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or storage full: the session still works, it just won't persist.
  }
}

export function loadProgress(): Progress {
  const raw = read(PROGRESS_KEY)
  try {
    return raw ? parseBackup(raw) : emptyProgress()
  } catch {
    return emptyProgress()
  }
}

export const saveProgress = (p: Progress) => write(PROGRESS_KEY, p)

export function loadSettings(): Settings {
  try {
    return { ...defaultSettings, ...JSON.parse(read(SETTINGS_KEY) ?? '{}') }
  } catch {
    return defaultSettings
  }
}

export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)
