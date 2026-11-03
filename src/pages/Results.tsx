import { toBlob } from 'html-to-image'
import { useRef, useState } from 'react'
import type { AppProps } from '../App.tsx'
import { GROUPS } from '../content.ts'
import { coverage, gapsByGroup, gapText, parseBackup, persona, visibleGroups, type Persona } from '../logic.ts'
import { Inline, Markdown } from '../Markdown.tsx'
import { mascot } from '../mascots.ts'
import { Radar } from '../Radar.tsx'

function personaMascot(p: Persona) {
  if (p.kind === 'locked') return null
  return mascot(p.kind === 'wanderer' ? 'wanderer' : p.id)
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export function Results({ progress, update, settings }: AppProps) {
  const groups = visibleGroups(GROUPS, settings.frontend)
  const who = persona(GROUPS, progress, settings.frontend)
  const m = personaMascot(who)
  const hero = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')

  const flash = (text: string) => {
    setNote(text)
    setTimeout(() => setNote(''), 2500)
  }

  const card = async () => {
    const blob = await toBlob(hero.current!, { pixelRatio: 2 })
    if (!blob) throw new Error('Could not render the card')
    return blob
  }
  const cardFile = async () => new File([await card()], 'skill-explorer.png', { type: 'image/png' })
  const canShare = typeof navigator.canShare === 'function'

  const copyImage = async () => {
    try {
      // Pass the promise straight in: Safari drops the user gesture across an await.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': card() })])
      flash('Image copied')
    } catch {
      flash("Couldn't copy the image here; try Download")
    }
  }
  const share = async () => {
    try {
      await navigator.share({ files: [await cardFile()] })
    } catch {
      // Cancelled or unsupported.
    }
  }

  const copyGaps = async () => {
    try {
      await navigator.clipboard.writeText(gapText(GROUPS, progress, settings.frontend))
      flash('Gap list copied')
    } catch {
      flash("Couldn't copy here")
    }
  }
  const backup = () =>
    download(new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }), 'skill-explorer-backup.json')
  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const restored = parseBackup(await file.text())
      update(() => restored)
      flash('Restored')
    } catch {
      flash("That file isn't a Skill Explorer backup")
    }
  }

  const gaps = gapsByGroup(GROUPS, progress, settings.frontend)

  return (
    <>
      <section className="hero-wrap">
        <div className="hero" ref={hero}>
          {m ? (
            <>
              <img className="persona-img" src={m.src} alt="" width={120} height={120} />
              <div className="persona-name">
                {m.animal} · {m.job}
              </div>
              {who.kind === 'wanderer' && <div className="muted">You roam every group evenly.</div>}
            </>
          ) : (
            <>
              <img className="persona-img silhouette" src={mascot('wanderer').src} alt="" width={120} height={120} />
              <div className="persona-name">Keep exploring</div>
              <div className="muted">Explore half of two groups to meet your mascot.</div>
            </>
          )}
          <Radar axes={groups.map((g) => ({ id: g.group.id, title: g.group.title, value: coverage(g, progress) }))} />
          <div className="hero-foot">Skill Explorer</div>
        </div>
        <div className="row center">
          <button onClick={copyImage}>Copy image</button>
          <button onClick={async () => download(await card(), 'skill-explorer.png')}>Download</button>
          {canShare && <button onClick={share}>Share</button>}
        </div>
      </section>

      <section>
        <h2>Your gaps</h2>
        {gaps.length === 0 && <p className="muted">No gaps yet. Scan or quiz a group to find some.</p>}
        {gaps.map(({ group, skills }) => (
          <div key={group.group.id} className="gap-group">
            <h3>{group.group.title}</h3>
            {skills.map(({ skill, gaps }) => (
              <div key={skill.id}>
                <h4>{skill.title}</h4>
                <ul className="gap-list">
                  {gaps.map((c) => {
                    const seen = progress.concepts[c.id]?.seen
                    const v = seen && c.variants[seen.variant]
                    return (
                      <li key={c.id}>
                        {v ? (
                          <details>
                            <summary>
                              <strong>{c.title}</strong>: <Inline text={c.summary} />
                            </summary>
                            <Markdown text={v.q} />
                            <p>
                              You picked <Inline text={v.choices[seen.choice]} />. Answer: <Inline text={v.choices[v.answer]} />
                            </p>
                            <Markdown text={v.explain} />
                          </details>
                        ) : (
                          <>
                            <strong>{c.title}</strong>: <Inline text={c.summary} />
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>

      <footer className="row">
        <button onClick={copyGaps} disabled={!gaps.length}>
          Copy gap list
        </button>
        <button onClick={backup}>Backup</button>
        <label className="button">
          Restore
          <input type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </label>
      </footer>
      <div className="toast" role="status">
        {note}
      </div>
    </>
  )
}
