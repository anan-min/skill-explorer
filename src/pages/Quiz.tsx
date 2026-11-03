import { useState } from 'react'
import type { AppProps } from '../App.tsx'
import { groupById } from '../content.ts'
import { answer, conceptsOf, pickVariant, quizQueue, type LangPref, type Progress } from '../logic.ts'
import { Question } from '../Question.tsx'
import { NotFound } from './Express.tsx'

const LANGS: [LangPref, string][] = [
  ['go', 'Go'],
  ['ts', 'TS'],
  ['both', 'Both'],
]

function newSession(groupId: string, progress: Progress, lang: LangPref) {
  const group = groupById(groupId)
  if (!group) return []
  return quizQueue(conceptsOf(group), progress, lang, Math.random).map((concept) => ({
    concept,
    variant: pickVariant(concept, progress, lang, Math.random)!,
  }))
}

export function Quiz({ groupId, progress, update, settings, setSettings }: AppProps & { groupId: string }) {
  const group = groupById(groupId)
  const [session, setSession] = useState(() => newSession(groupId, progress, settings.lang))
  const [index, setIndex] = useState(0)
  if (!group) return <NotFound />

  const setLang = (lang: LangPref) => {
    setSettings({ ...settings, lang })
    setSession(newSession(groupId, progress, lang))
    setIndex(0)
  }
  const restart = () => {
    setSession(newSession(groupId, progress, settings.lang))
    setIndex(0)
  }
  const current = session[index]

  return (
    <section>
      <div className="row spread">
        <p className="muted">
          {group.group.title}
          {current && ` · ${index + 1} of ${session.length}`}
        </p>
        <div className="segmented" role="group" aria-label="Language">
          {LANGS.map(([lang, label]) => (
            <button key={lang} aria-pressed={settings.lang === lang} onClick={() => setLang(lang)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {current ? (
        <Question
          key={index}
          concept={current.concept}
          variant={current.variant}
          onAnswer={(choice) => update((p) => answer(p, current.concept, current.variant, choice))}
          onNext={() => setIndex(index + 1)}
        />
      ) : (
        <div className="done">
          <h1>{session.length ? 'Session done' : 'Nothing left to quiz here'}</h1>
          <div className="row">
            {session.length > 0 && (
              <button className="primary" onClick={restart}>
                Another 10
              </button>
            )}
            <a className="button" href="#/results">
              See your map
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
