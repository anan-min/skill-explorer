// Each topic has an animal and a job (a hat and a tool). A persona is one topic's animal
// in another topic's job, drawn as public/mascots/<animal topic>--<job topic>.png.
// Keep files same-origin: cross-origin images break the PNG share card.
// `trait` (from the animal) and `deed` (from the job) join into the persona's description,
// so every combo reads differently: "Juggles eight languages at once and guards every release with tests."
export const TOPIC_MASCOTS = {
  "language-runtime": {
    animal: "Octopus",
    job: "Mage",
    trait: "Juggles eight languages at once",
    deed: "bends runtimes to its will",
  },
  "data-structures-algorithms": {
    animal: "Owl",
    job: "Ranger",
    trait: "Sees the shortest path in the dark",
    deed: "hits the right algorithm on the first try",
  },
  "code-craft": {
    animal: "Bear",
    job: "Blacksmith",
    trait: "Builds code that can take a hit",
    deed: "hammers messy code into shape",
  },
  "design-architecture": {
    animal: "Cat",
    job: "Noble",
    trait: "Lands every design on its feet",
    deed: "rules the architecture with a flick of the wand",
  },
  backend: {
    animal: "Ant",
    job: "Merchant",
    trait: "Carries requests many times its size",
    deed: "trades fair APIs at every gate",
  },
  "data-storage": {
    animal: "Crow",
    job: "Alchemist",
    trait: "Never forgets where a row is buried",
    deed: "turns slow queries into gold",
  },
  testing: {
    animal: "Rat",
    job: "Knight",
    trait: "Sniffs out the bug no one else can find",
    deed: "guards every release with tests",
  },
  "delivery-ops": {
    animal: "Rhino",
    job: "Warrior",
    trait: "Charges through any deploy",
    deed: "fights the fires in production",
  },
  frontend: {
    animal: "Golden retriever",
    job: "Bard",
    trait: "Makes every user feel welcome",
    deed: "sings interfaces into being",
  },
} as const;

// Never combined with another topic's job.
const SOLO = {
  wanderer: {
    animal: "Fox",
    job: "Wanderer",
    tagline: "Roams every corner of the map and feels at home in all of them.",
  },
  apprentice: {
    animal: "Chick",
    job: "Apprentice",
    tagline: "Fresh out of the egg, with the whole map still to explore.",
  },
} as const;

// Drawings that exist in public/mascots/, without `.png`: `<animal>--<job>` for topics,
// `wanderer` and `apprentice`. Add a name here when its PNG lands; anything not listed
// falls back to the animal's own drawing, then to the `<id>.svg` placeholder.
const DRAWN = new Set<string>([]);

export const MASCOT_IDS = [...Object.keys(TOPIC_MASCOTS), ...Object.keys(SOLO)];

type TopicId = keyof typeof TOPIC_MASCOTS;

const file = (name: string) => `${import.meta.env.BASE_URL}mascots/${name}`;

// `id` picks the animal, `job` the job (a topic id; defaults to the animal's own).
export function mascot(id: string, job: string = id) {
  if (id in SOLO) {
    const m = SOLO[id as keyof typeof SOLO];
    return { ...m, src: file(DRAWN.has(id) ? `${id}.png` : `${id}.svg`) };
  }
  const animal = id in TOPIC_MASCOTS ? (id as TopicId) : null;
  if (!animal) return mascot("wanderer");
  const jobId = job in TOPIC_MASCOTS ? (job as TopicId) : animal;
  const name = [`${animal}--${jobId}`, `${animal}--${animal}`].find((n) => DRAWN.has(n));
  return {
    animal: TOPIC_MASCOTS[animal].animal,
    job: TOPIC_MASCOTS[jobId].job,
    tagline: `${TOPIC_MASCOTS[animal].trait} and ${TOPIC_MASCOTS[jobId].deed}.`,
    src: file(name ? `${name}.png` : `${animal}.svg`),
  };
}
