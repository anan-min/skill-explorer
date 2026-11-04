// Each topic has an animal and a job (a hat and a tool). A persona is one topic's animal
// in another topic's job, drawn as public/mascots/<animal topic>--<job topic>.png.
// Keep files same-origin: cross-origin images break the PNG share card.
// `trait` (from the animal) and `deed` (from the job) join into the persona's description,
// so every combo reads differently: "Juggles eight languages at once, one per tentacle, and stands guard
// over every release with a shield made of tests."
export const TOPIC_MASCOTS = {
  "language-runtime": {
    animal: "Octopus",
    job: "Mage",
    trait: "Juggles eight languages at once, one per tentacle",
    deed: "casts runtime spells that make the garbage collector bow",
  },
  "data-structures-algorithms": {
    animal: "Owl",
    job: "Ranger",
    trait: "Spots the shortest path from three branches away, even at midnight",
    deed: "never misses the right algorithm, even with Big O breathing down its neck",
  },
  "code-craft": {
    animal: "Bear",
    job: "Blacksmith",
    trait: "Writes code sturdy enough to survive a Friday deploy",
    deed: "hammers tangled legacy code into something worth showing off",
  },
  "design-architecture": {
    animal: "Cat",
    job: "Noble",
    trait: "Always lands its designs on their feet, then naps on the whiteboard",
    deed: "decrees clean boundaries with one regal flick of the wand",
  },
  backend: {
    animal: "Ant",
    job: "Merchant",
    trait: "Hauls requests ten times its own weight without breaking a sweat",
    deed: "haggles over every endpoint until the API deal is fair",
  },
  "data-storage": {
    animal: "Crow",
    job: "Alchemist",
    trait: "Remembers exactly where every shiny row is buried",
    deed: "brews indexes that turn slow queries into pure gold",
  },
  testing: {
    animal: "Rat",
    job: "Knight",
    trait: "Sniffs out the bug nobody else could find, usually hiding in the walls",
    deed: "stands guard over every release with a shield made of tests",
  },
  "delivery-ops": {
    animal: "Rhino",
    job: "Warrior",
    trait: "Charges through deploys like the pipeline owes it money",
    deed: "storms into production fires with an axe and a runbook",
  },
  frontend: {
    animal: "Golden retriever",
    job: "Bard",
    trait: "Greets every user like they're its favourite person",
    deed: "sings interfaces so smooth that users hum along",
  },
} as const;

// Never combined with another topic's job.
const SOLO = {
  wanderer: {
    animal: "Fox",
    job: "Wanderer",
    tagline:
      "Has wandered every corner of the map, knows all the shortcuts, and feels at home everywhere. The pack is always ready for the next trail.",
  },
  apprentice: {
    animal: "Chick",
    job: "Apprentice",
    tagline:
      "Fresh out of the egg and blinking at a very big map. Every path is still open, so pick one and start pecking.",
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
    tagline: `${TOPIC_MASCOTS[animal].trait}, and ${TOPIC_MASCOTS[jobId].deed}.`,
    src: file(name ? `${name}.png` : `${animal}.svg`),
  };
}
