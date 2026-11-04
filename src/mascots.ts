// Each topic has an animal and a job (a hat and a tool). A persona is one topic's animal
// in another topic's job, drawn as public/mascots/<animal topic>--<job topic>.png.
// Keep files same-origin: cross-origin images break the PNG share card.
export const TOPIC_MASCOTS = {
  "language-runtime": { animal: "Octopus", job: "Mage" },
  "data-structures-algorithms": { animal: "Owl", job: "Ranger" },
  "code-craft": { animal: "Bear", job: "Blacksmith" },
  "design-architecture": { animal: "Cat", job: "Noble" },
  backend: { animal: "Ant", job: "Merchant" },
  "data-storage": { animal: "Crow", job: "Alchemist" },
  testing: { animal: "Rat", job: "Knight" },
  "delivery-ops": { animal: "Rhino", job: "Warrior" },
  frontend: { animal: "Golden retriever", job: "Bard" },
} as const;

// Never combined with another topic's job.
const SOLO = {
  wanderer: { animal: "Fox", job: "Wanderer" },
  apprentice: { animal: "Chick", job: "Apprentice" },
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
    src: file(name ? `${name}.png` : `${animal}.svg`),
  };
}
