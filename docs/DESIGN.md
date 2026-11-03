# Nerdscape — design

The app is called **Nerdscape**. The repo, Pages URL (`/skill-explorer/`) and `localStorage` keys keep the old `skill-explorer` name so links and saved progress survive.

A for-fun static web app where software engineers discover hard-skill concepts they've missed and see a map of their gaps. It's for learning, not evaluation: no grades, no rankings, no comparisons between people, and all data stays in the browser.

This doc is the spec. Build from it; when something here turns out wrong, fix it here too.

## Principles

- **For fun.** Don't over-engineer; fix problems later.
- **No ratings.** Never ask "how well do you know X?". Every answer is a fact the person can check against memory. The persona and the numbers come only from quiz answers, never from self-assessment, and the beginner class is named as a stage (Apprentice), not a level.
- **No learning guidance.** No reading lists, links, reading time, "mark as read" or prerequisites. The explanation shown after each answer is the only teaching.
- **Private by default.** Everything lives in `localStorage` (every access wrapped in try/catch). No backend, no analytics.

## Stack and hosting

- Vite + React + TypeScript.
- Hash routing (`#/scan`, `#/quiz`, `#/results`), because GitHub Pages has no SPA fallback.
- UI: shadcn/ui (copied into `src/components/ui`) on Tailwind v4, black and white on an off-white page. Besides the mascots, the only colour is two pastels in the gap list: rose (Missed) and butter (Heard). They sit behind near-black text, never as text colour. No solid black fills anywhere: a picked option (scan answer, language toggle, the right quiz answer), every main-action button and the progress bar are soft greys, and code blocks are a light grey panel. Text stays near-black for readability.
- GitHub Pages at `anan-min.github.io/skill-explorer`, deployed by GitHub Actions on push to `main`.
- English only.
- The owner merges on their own judgment; CI validation is the only gate.

## Content model

### Groups (54 skills)

| # | Group | Mascot |
|---|---|---|
| 1 | Language & runtime | Octopus · Interpreter |
| 2 | Data structures & algorithms | Owl · Navigator |
| 3 | Code craft | Beaver · Builder |
| 4 | Design & architecture | Spider · Bridge architect |
| 5 | Backend | Ant · Porter |
| 6 | Data & storage | Squirrel · Storekeeper |
| 7 | Testing | Meerkat · Lookout |
| 8 | Delivery & ops | Husky · Sled runner |
| 9 | Frontend | Chameleon · Signaller |
| — | Strong in every group | Fox · Backpacker (Wanderer) |
| — | Strong in no group yet | Chick · Apprentice |

Skills per group:

1. **Language & runtime:** types & memory, control flow, functions & scope (closures), OOP, functional programming, error handling, async, concurrency.
2. **Data structures & algorithms:** data structures, Big O.
3. **Code craft:** readability & standards, simple design, refactoring, code review, Git, debugging, documentation, tech debt.
4. **Design & architecture:** OO design, design patterns, API design, system design, architecture decisions. System design also covers systems-thinking concepts: blast radius, cascading failure, backpressure, upstream/downstream dependencies and contracts, retry storms.
5. **Backend:** REST, authn/authz, background jobs & queues, caching, security.
6. **Data & storage:** schema design, query optimization, transactions & consistency, migrations, relational vs NoSQL, DB integration.
7. **Testing:** test strategy, unit, integration, TDD, test maintainability, ATDD/BDD.
8. **Delivery & ops:** CI, release & deployment, Docker, environment management, cloud, observability, incident response.
9. **Frontend:** components, state, performance, accessibility, responsive design, frontend security. Always shown: users are assumed full stack.

### Concepts

A **concept** is valid only if:

1. it has a name you could search for (`errgroup`, `Promise.allSettled`, "cascading failure"), and
2. either one multiple-choice question can show whether someone knows it, with one unambiguous right answer and all variants testing the same thing (otherwise split it), **or** it's a practice a person can answer "have I done this?" about without hesitating (reading a query plan, writing an ADR).

Two kinds:

- **Quizzable** (the default): 2 or more variants.
- **Scan-only:** `variants: []`. Self-report only, for practices where a multiple-choice question would be trivia.

Aim for 4–8 concepts per skill. First release: all groups, about 350 concepts × 2–4 variants ≈ 700–1,000 questions, LLM-drafted and reviewed by the owner.

### Files

One file per group: `content/NN-<group-id>.json` (`01-language-runtime.json` … `09-frontend.json`). Group IDs, in order: `language-runtime`, `data-structures-algorithms`, `code-craft`, `design-architecture`, `backend`, `data-storage`, `testing`, `delivery-ops`, `frontend`.

```jsonc
{
  "group": { "id": "language-runtime", "title": "Language & runtime" },
  "skills": [{
    "id": "async",
    "title": "Asynchronous programming",
    "concepts": [{
      "id": "language-runtime/async/errgroup",   // group/skill/slug
      "title": "errgroup",
      "summary": "One line, shown in the gap list",
      "basic": true,                              // optional: a foundational question, see step 2
      "variants": [{                              // [] = scan-only
        "lang": "go",                             // "go" | "ts" | null
        "q": "Markdown, code fences allowed",
        "choices": ["…", "…", "…", "…"],
        "answer": 2,                              // index into choices
        "explain": "Shown after answering"
      }]
    }]
  }]
}
```

### CI checks (zod)

- Every file matches the schema.
- Concept IDs are unique and match their file's group and their skill.
- `variants` has length 0 or ≥ 2.
- Exactly 4 choices, all distinct.
- `answer` is 0–3; `explain` is non-empty.
- More than 8 concepts in a skill: warning, not failure.
- Every group has at least one quizzable concept with `"basic": true`.

## States

Each concept is in one state:

| State | Meaning | Set by |
|---|---|---|
| `fog` | Not looked at yet | default |
| `gap` | Doesn't know it | "Never heard of it", "Know the name", or a wrong answer |
| `claimed` | Says they've used it | "Used it" |
| `confirmed` | Shown to know it | a correct answer (first try counts) |

- Later answers can move a concept between states.
- **Explored** = any state except `fog`.
- Scan-only concepts top out at `claimed`.

## Two buttons, both cover every topic

Home has two buttons, so people know up front what they're starting. Neither lets someone do only one topic and get a result.

- **Quick scan** (`#/scan`, about 2 min): step 1 only, then the result, based on self-reports.
- **Quiz** (`#/quiz`, about 5 min): step 1, then step 2, then the result, checked against quiz answers.

### Step 1: quick scan (breadth)

- One page, **4 concepts from every topic** under topic headings, unexplored concepts first, so repeat runs reach further into each topic.
- Each row has a three-way toggle:
  - **New** (never heard of it) → `gap`
  - **Heard** (know the name) → `gap`
  - **Used** → `claimed`
- A gap remembers which button made it (`scan: "never" | "name"`), so rows show earlier answers.
- The next button ("See my result" in a scan, "Next: quick check" in a quiz) stays disabled until every row is answered.

### Step 2: quick check (depth, aimed at claims)

- **Every topic gets one check**, picked in this order: a **Used** claim, else a **Heard**, else the topic's **basic** question. "New" rows are never quizzed (that would be guessing); the basic question is a different, foundational concept.
- Then up to **3 extra** checks on unchecked Used claims, spread round-robin over the topics with the most claims.
- At most **12** checks. Never a `confirmed` concept.
- Choices are shuffled when shown, since LLM-drafted questions tend to put the answer in the same position.
- After each answer, show the right answer and `explain`. Each answer is saved immediately.
- **Language toggle:** Go / TS / Both, default Both. With Both, prefer the language not yet tested for that concept. Variants with `lang: null` always qualify.
- Each question has a **"Report this question"** link: a prefilled new GitHub issue titled `[report] <concept id> #<variant index>`. Nothing personal in the link.

## Results page

### Hero: persona + radar

- **Strength** per topic = average over its explored concepts of: quiz right 1, unverified Used ¾, Heard ½, New 0, quiz wrong 0. A quiz answer replaces the self-report for that concept; unverified claims count less so claiming everything doesn't pay.
- **Radar:** strength per topic, no numbers, drawn as a soft grey filled shape with no outline and no dots.
- **Unlock:** once every topic has its scan rows answered (a finished Quick scan or Quiz). Before that, a silhouette and "finish a quick scan or a quiz".
- **Checked or claimed:** until every quizzable topic has a quiz answer, the hero says "Based on what you said. Take the quiz to check it."
- **Persona rule:** a topic **passes** at ≥ 60% strength.
  - No topic passes → **Apprentice**.
  - Every topic passes → **Wanderer**.
  - Otherwise → the strongest passing topic's mascot. Tie → more `confirmed` concepts, then the lower group number.
- Results accumulate across runs (latest answer per concept), so later runs sharpen the result.

### Your gaps

Every `gap` concept, grouped by group → skill, with groups sorted by gap count. Each item shows the title and summary, and expands to the question and explanation they saw if the gap came from a quiz. Each item is tagged by where the gap came from: **Missed** (wrong in the quiz; rose tag and left stripe), **Heard** (butter tag and stripe) or **New** (grey tag, no stripe, so a long list of unmet concepts doesn't read as an alarm). No links, no how-to-learn.

### Your numbers

Below the gaps, never on the share card: right and wrong quiz answers, "Used it" and unexplored counts, and per group "X of Y correct · X of Y explored".

### Footer

- **Copy gap list** as plain text (it doubles as a personal growth note).
- **Backup / Restore:** a JSON file with `schemaVersion`, states keyed by concept ID.
- One line on the first screen saying the data lives in this browser. No export nagging.

## Sharing

- The hero exports as a PNG card (persona, mascot and radar, **no numbers**) via `html-to-image`.
- Buttons: **Copy image** (`ClipboardItem`), **Download**, **Share** (`navigator.share` with the file, on mobile).
- No share links: a per-user Slack/OG preview would need a backend.
- If `html-to-image` renders badly, switch to drawing the card by hand on `<canvas>`.
- `html-to-image` drops SVG paint set through CSS classes, so the radar sets `fill`/`stroke` as attributes.

## Mascots

- The owner draws them by hand. Until then, ship placeholders.
- Placeholders: `public/mascots/<id>.svg`, where `<id>` is the group ID, `wanderer` or `apprentice`. Each is a coloured circle with the animal emoji and job name (e.g. 🐙 Interpreter). There is no meerkat or husky emoji, so those two use 🦦 and 🐺 until drawn.
- `src/mascots.ts` maps each ID to its file, so swapping in a drawing (PNG or SVG) is a one-line change.
- No external placeholder services: cross-origin images break the PNG export.

## Build order

1. Scaffold: Vite + React + TS, hash routing, Pages deploy workflow.
2. Zod schema + CI validation.
3. Placeholder mascots + `src/mascots.ts`.
4. One sample group with a few concepts, so both routes and the results page work end to end.
5. Then draft content group by group, each reviewed by the owner before the next.
