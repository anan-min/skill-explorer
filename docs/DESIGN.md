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
- UI: shadcn/ui (copied into `src/components/ui`) on Tailwind v4, black and white on an off-white page. Besides the mascots and the results radar (drawn in the persona animal's own colour, from `color` in `src/mascots.ts`; grey before there's a persona), the only colour is two pastels in the gap list: rose (Missed) and butter (Heard). They sit behind near-black text, never as text colour. A picked option (scan answer, language toggle, the right quiz answer), every main-action button and the progress bar are solid black for contrast; code blocks are a light grey panel. Text stays near-black for readability. On phones (under `sm`) every button, toggle, topic chip and header link is at least 44px tall.
- GitHub Pages at `anan-min.github.io/skill-explorer`, deployed by GitHub Actions on push to `main`.
- English only.
- The owner merges on their own judgment; CI validation is the only gate.

## Content model

### Groups (54 skills)

| # | Group | Animal · job |
|---|---|---|
| 1 | Language & runtime | Octopus · Mage |
| 2 | Data structures & algorithms | Owl · Ranger |
| 3 | Code craft | Bear · Smith |
| 4 | Design & architecture | Cat · Priest |
| 5 | Backend | Ant · Merchant |
| 6 | Data & storage | Crow · Alchemist |
| 7 | Testing | Mouse · Knight |
| 8 | Delivery & ops | Rhino · Warrior |
| 9 | Frontend | Golden retriever · Bard |
| — | Strong in 7 or more of the 9 topics | Fox · Wanderer |
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
- **Scan-only:** `variants: []`. Never asked; listed under its skill as something to explore.

Each concept has a **level**:

- **Easy:** what the skill's summary names (loops, recursion, promises, N+1). Quick scan asks only these.
- **Medium:** everyday working knowledge.
- **Hard:** the niche and senior-level material (switch fallthrough, PACELC).

Aim for 2 easy, 2 medium and 2 hard per skill.

Aim for 4–8 concepts per skill. First release: all groups, about 350 concepts × 2–4 variants ≈ 700–1,000 questions, LLM-drafted and reviewed by the owner.

### Files

One file per group: `content/NN-<group-id>.json` (`01-language-runtime.json` … `09-frontend.json`). Group IDs, in order: `language-runtime`, `data-structures-algorithms`, `code-craft`, `design-architecture`, `backend`, `data-storage`, `testing`, `delivery-ops`, `frontend`.

```jsonc
{
  "group": { "id": "language-runtime", "title": "Language & runtime" },
  "skills": [{
    "id": "async",
    "title": "Async",
    "summary": "Sync vs async, callbacks, promises, async/await and the event loop",  // the scan row
    "concepts": [{
      "id": "language-runtime/async/errgroup",   // group/skill/slug
      "title": "errgroup",
      "summary": "One line, shown under the skill",
      "level": "medium",                          // "easy" | "medium" | "hard", see Questions
      "variants": [{                              // [] = scan-only
        "lang": "go",                             // "go" | "ts" | "python" | null
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
- Every group has at least one quizzable easy concept; a skill without one is a warning.

## Progress

What a person did, saved in this browser:

- **Ratings:** one per skill, keyed `<group id>/<skill id>`: `new`, `heard`, `used`, `strong` or `expert`.
- **Answers:** the latest answer per concept: which variant was shown and which choice was picked.
- **`finished`:** set once a Quick scan or Quiz reaches its result.

Progress is `schemaVersion: 2`. Version 1 (one state per concept) doesn't load; the app starts empty instead.

## Two buttons, both cover every topic

Home has two buttons, so people know up front what they're starting. Both rate every skill, then ask questions; they differ in how many and how hard.

| | Quick scan (`#/scan`) | Quiz (`#/quiz`) |
|---|---|---|
| Step 1 | Rate all 53 skills, one topic per page | Same, pre-filled from earlier runs |
| Step 2 | 9 questions, one per topic, easy only | Up to 18 questions, easy → medium → hard |
| Time | About 5 min | About 10 min |

### Step 1: rate every skill

- One page per topic, one row per skill: title and summary, then **New** (never heard of it) / **Heard** (know the name) / **Used** (used it, still look things up) / **Strong** (use it often without looking things up) / **Expert** (could teach it, edge cases included). On a phone the five buttons fill a row under the skill.
- Rows show earlier ratings. "Next" stays disabled until every row on the page is rated.

### Step 2: questions

- **Quick scan:** in each topic, a skill rated Expert, else Strong, else Used, else Heard, else any skill; one of its **easy** concepts.
- **Quiz:**
  1. One question per topic from a skill rated Expert, else Strong, else Used, else Heard. A topic with nothing claimed gets an easy question from any skill.
  2. Then the other claimed skills, highest rating first (Expert, Strong, Used, then Heard), up to **18** questions.
  3. Each skill's question is at the **lowest level not yet answered right**: easy, then medium once easy is right, then hard. So repeat runs climb.
- A skill rated New is never asked in a topic that has claims (that would be guessing).
- Concepts not asked before come first.
- Choices are shuffled when shown, since LLM-drafted questions tend to put the answer in the same position.
- After each answer, show the right answer and `explain`. Each answer is saved immediately.
- **Language toggle:** Go / TS / Python, default TS. A question is picked at random from the variants in that language; variants with `lang: null` always qualify.
- Each question has a **"Report this question"** link: a prefilled new GitHub issue titled `[report] <concept id> #<variant index>`. Nothing personal in the link.

## Scoring

Each skill gets a score from 0 to 1:

1. **Start** from its rating: New **0**, Heard **0.4**, Used **0.7**, Strong **0.85**, Expert **1**.
2. **Add** each answered concept's effect, counting only the latest answer per concept:

| | Easy | Medium | Hard |
|---|---|---|---|
| Right | +0.10 | +0.15 | +0.20 |
| Wrong | −0.4 | −0.3 | −0.15 |

3. **Clamp** to 0–1.
4. **Cap** while a miss stands: missing an easy question caps the skill at **0.4** (Heard), a medium one at **0.55**, a hard one at **0.7** (Used). The lowest cap wins. So the bigger the claim, the further a miss drops it: Expert missing an easy question goes 1 → 0.4, Used goes 0.7 → 0.3 (the penalty alone already takes it under the cap). Answering that concept right later lifts the cap.

Missing an easy question says the most, missing a hard one little, and only right answers lift a skill above 0.7, so claiming everything doesn't pay. A topic's **strength** is the average of its rated skills. The numbers are constants in `src/logic.ts`.

## Results page

The header's **Your map** link (to `#/results`) shows only once a Quick scan or Quiz reaches its result (saved as `finished` in progress, so rating the skills and then leaving doesn't count), and is hidden during a run, since leaving mid-run drops the run's questions.

### Hero: persona + radar

- **Radar:** strength per topic, no numbers, drawn as a filled shape with a 2px outline in the persona animal's colour, no dots; grey with no outline before there's a persona.
- **Unlock:** once every skill is rated (a finished Quick scan or Quiz). Before that, a silhouette and "finish a quick scan or a quiz".
- **Checked:** "Checked X of Y claimed skills", where a claimed skill is rated Heard or higher and checked means it has had a question. While some aren't checked: "Take the quiz to check more."
- **Persona rule:** a topic **passes** at ≥ 60% strength and with no more missed answers than right ones in it. A skill's question only moves that skill, so without the second part, rating everything Used and missing every question still passed most topics.
  - No topic passes → **Apprentice**.
  - 7 or more of the 9 topics pass → **Wanderer** (`WANDERER_AT` in `src/logic.ts`; with fewer than 7 topics, all of them). It was 5, but then anyone rating Used in 5 topics and answering right got the Fox, crowding out the combos.
  - One topic passes → that topic's animal in its own job (e.g. Mouse · Knight).
  - Two or more pass → the strongest topic's animal in the second-strongest topic's job (e.g. Octopus · Knight); a third or later topic doesn't change it. Ranking: strength, then more right answers, then the lower group number.
- Results accumulate across runs, so later runs sharpen the result.

Below the hero, two summary cards keep the results page short; each links to its own page (`#/gaps`, `#/skills`) with "← Back to your map" and topic chips (All, then each topic with its count) that show one topic at a time.

- **Your gaps card:** "N skills to work on · M missed questions", the 3 topics with the most gap skills, **See all gaps →**.
- **Your skills card:** "N of M strong · K checked" (strong = score ≥ 60%), the 3 strongest and 3 weakest rated skills with their score, **See all skills →**.

### Your gaps page

By topic, sorted by size: every skill rated **New** (grey tag, no stripe) or **Heard** (butter), or scoring under 50% (**Low score**, rose), with its summary. Under each skill, every missed question, tagged with its level (easy first), expanding to the question, the picked choice, the answer and the explanation. No links, no how-to-learn.

### Your skills page

Never on the share card: right and missed answers, skills rated Used or higher, and skills not rated. Then every topic's skills with their score and whether they're checked; each expands to its concepts ("To explore"), with their level and result.

### Footer

- **Copy gap list** as plain text (it doubles as a personal growth note).
- **Download report:** a Markdown file (`nerdscape-report.md`) with the persona and how many claims are checked, then every topic → skill with its rating and score → concept with its level and result (Right, Missed or Not asked). Each missed concept also has the question, the picked choice, the answer and the explanation.

- One line on the first screen saying the data lives in this browser. No export nagging.

## Sharing

- The hero exports as a PNG card (persona, mascot and radar, **no numbers**) via `html-to-image`.
- Sharing is the page's main action, so its buttons come first, right under the card, each with an icon: **Share your nerd** (`navigator.share` with the file, where supported; the filled button), **Copy image** (`ClipboardItem`; filled when Share isn't available), **Save image** (downloads the PNG).
- A second row: **Take the quiz →** / **Quiz again →** (outline) and **Start over** (ghost): after a confirm, clears all progress in this browser (the language choice stays) and goes to Home. A second confirm asks whether to clear the nerd dex too; Cancel keeps it.
- No share links: a per-user Slack/OG preview would need a backend.
- If `html-to-image` renders badly, switch to drawing the card by hand on `<canvas>`.
- `html-to-image` drops SVG paint set through CSS classes, so the radar sets `fill`/`stroke` as attributes.

## Mascots

- The owner draws them by hand; all 83 are in.
- Each persona has a one-line description under its name, on the card and in the report: the animal's trait plus the job's deed ("Juggles eight languages at once, one per tentacle, and stands guard over every release with a shield made of tests."), so each of the 81 topic combos reads differently. Fox and Chick have their own line. The lines live in `src/mascots.ts`.
- Each job is one hat and one tool, so a combo is one topic's animal wearing another topic's hat and holding its tool. The page prints animal and job, so drawings carry no lettering.
- Drawings: 512×512 white-background JPGs in `public/mascots/`, named `<animal topic>--<job topic>.jpg` (`testing--testing.jpg` for Mouse · Knight, `language-runtime--testing.jpg` for Octopus · Knight), plus `wanderer.jpg` and `apprentice.jpg`: all 81 combos plus Fox and Chick, about 25 KB each.
- Framing: each drawing is centred on its 512px square with at least ~45px white padding. One scale per animal (the largest of its 9 drawings fills 420px), so the body stays the same size when the hat and tool change.
- The backgrounds are white, so every mascot sits on a white rounded card on the off-white page.
- No external placeholder services: cross-origin images break the PNG export.

## Nerd dex

- Players see the mascots as **nerds**: header link "Nerds", page "Nerd dex", results link "Nerd dex · X of 83 found". Code, the route (`#/mascots`), image paths and the `skill-explorer:collection` key keep the mascot name, so links and saved collections still work.
- `#/mascots`, linked from the header (except mid-run) and under the results buttons.
- All 83 mascots numbered #001–#083 in `DEX` order (`src/mascots.ts`): each animal's 9 jobs, one row per animal, then Fox and Chick.
- **Collectible:** the mascot on your results page joins the dex, stored under `skill-explorer:collection` (a list of `dexKey`s: `<animal topic>--<job topic>`, `wanderer`, `apprentice`). Quizzing again or ending up stronger elsewhere finds more.
- Found ones show in full with their job; the rest are grey silhouettes (an SVG filter, since the JPGs' white backgrounds would black out with `brightness-0`) with their number.
- Tapping one opens its card under that row: number, name and description when found, `???` when not, and always how to get it ("Strongest in Frontend, second strongest in Code craft").

## Build order

1. Scaffold: Vite + React + TS, hash routing, Pages deploy workflow.
2. Zod schema + CI validation.
3. Placeholder mascots + `src/mascots.ts`.
4. One sample group with a few concepts, so both routes and the results page work end to end.
5. Then draft content group by group, each reviewed by the owner before the next.
