import { z } from 'zod'
import type { Concept, GroupFile } from './schema.ts'

const Lang = z.enum(['go', 'ts'])
const StateSchema = z.enum(['fog', 'gap', 'claimed', 'confirmed'])
const ConceptProgress = z.object({
  state: StateSchema,
  // The quiz question behind a gap, so the gap list can show it again.
  seen: z.object({ variant: z.number().int(), choice: z.number().int() }).optional(),
  tested: z.array(Lang).optional(),
})
const ProgressSchema = z.object({
  schemaVersion: z.literal(1),
  concepts: z.record(z.string(), ConceptProgress),
})

export type State = z.infer<typeof StateSchema>
export type Progress = z.infer<typeof ProgressSchema>
export type LangPref = 'go' | 'ts' | 'both'
export type ScanButton = 'never' | 'name' | 'used'
export type Persona = { kind: 'locked' } | { kind: 'wanderer' } | { kind: 'group'; id: string }

const SESSION_LENGTH = 10
const UNLOCK_GROUPS = 2
const UNLOCK_COVERAGE = 0.5
const WANDERER_SPREAD = 0.15

export const emptyProgress = (): Progress => ({ schemaVersion: 1, concepts: {} })

export const stateOf = (p: Progress, id: string): State => p.concepts[id]?.state ?? 'fog'

export function scan(p: Progress, concept: Concept, button: ScanButton): Progress {
  const { tested } = p.concepts[concept.id] ?? {}
  const state = button === 'used' ? 'claimed' : 'gap'
  return { ...p, concepts: { ...p.concepts, [concept.id]: { state, ...(tested && { tested }) } } }
}

export function answer(p: Progress, concept: Concept, variant: number, choice: number): Progress {
  const v = concept.variants[variant]
  const prev = p.concepts[concept.id]?.tested ?? []
  const tested = v.lang && !prev.includes(v.lang) ? [...prev, v.lang] : prev
  const next =
    choice === v.answer
      ? { state: 'confirmed' as const }
      : { state: 'gap' as const, seen: { variant, choice } }
  return { ...p, concepts: { ...p.concepts, [concept.id]: { ...next, ...(tested.length && { tested }) } } }
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function pickVariant(concept: Concept, p: Progress, lang: LangPref, rand: () => number): number | null {
  const eligible = concept.variants
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => lang === 'both' || v.lang === null || v.lang === lang)
  if (!eligible.length) return null
  const tested = p.concepts[concept.id]?.tested ?? []
  const untested = lang === 'both' ? eligible.filter(({ v }) => v.lang && !tested.includes(v.lang)) : []
  const pool = untested.length ? untested : eligible
  return pool[Math.floor(rand() * pool.length)].i
}

export function quizQueue(concepts: Concept[], p: Progress, lang: LangPref, rand: () => number): Concept[] {
  const askable = concepts.filter((c) => pickVariant(c, p, lang, rand) !== null)
  return (['claimed', 'fog', 'gap'] as const)
    .flatMap((state) => shuffle(askable.filter((c) => stateOf(p, c.id) === state), rand))
    .slice(0, SESSION_LENGTH)
}

export const conceptsOf = (g: GroupFile): Concept[] => g.skills.flatMap((s) => s.concepts)

export const visibleGroups = (groups: GroupFile[], frontend: boolean) =>
  groups.filter((g) => frontend || !g.group.hidden)

export function coverage(g: GroupFile, p: Progress): number {
  const concepts = conceptsOf(g)
  if (!concepts.length) return 0
  return concepts.filter((c) => stateOf(p, c.id) !== 'fog').length / concepts.length
}

export function persona(groups: GroupFile[], p: Progress, frontend = false): Persona {
  const rows = visibleGroups(groups, frontend).map((g, order) => ({
    id: g.group.id,
    order,
    cov: coverage(g, p),
    confirmed: conceptsOf(g).filter((c) => stateOf(p, c.id) === 'confirmed').length,
  }))
  if (rows.filter((r) => r.cov >= UNLOCK_COVERAGE).length < UNLOCK_GROUPS) return { kind: 'locked' }
  const covs = rows.map((r) => r.cov)
  // Compare in whole points so float noise can't flip the 15-point rule.
  if (Math.round((Math.max(...covs) - Math.min(...covs)) * 100) <= WANDERER_SPREAD * 100) return { kind: 'wanderer' }
  const [top] = [...rows].sort((a, b) => b.cov - a.cov || b.confirmed - a.confirmed || a.order - b.order)
  return { kind: 'group', id: top.id }
}

export function gapsByGroup(groups: GroupFile[], p: Progress, frontend: boolean) {
  return visibleGroups(groups, frontend)
    .map((g) => {
      const skills = g.skills
        .map((s) => ({ skill: s, gaps: s.concepts.filter((c) => stateOf(p, c.id) === 'gap') }))
        .filter((s) => s.gaps.length)
      return { group: g, skills, count: skills.reduce((n, s) => n + s.gaps.length, 0) }
    })
    .filter((g) => g.count)
    .sort((a, b) => b.count - a.count)
}

export function gapText(groups: GroupFile[], p: Progress, frontend: boolean): string {
  return gapsByGroup(groups, p, frontend)
    .map(({ group, skills }) =>
      [group.group.title, ...skills.flatMap(({ skill, gaps }) => [`  ${skill.title}`, ...gaps.map((c) => `  - ${c.title}: ${c.summary}`)])].join('\n'),
    )
    .join('\n\n')
}

export const parseBackup = (text: string): Progress => ProgressSchema.parse(JSON.parse(text))
