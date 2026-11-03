// Placeholder mascots. To swap in a drawing, drop the file into public/mascots/
// and change that entry's `file` (PNG or SVG). Keep it same-origin: cross-origin
// images break the PNG share card.
export const MASCOTS = {
  "language-runtime": { animal: "Octopus", job: "Interpreter", file: "language-runtime.svg" },
  "data-structures-algorithms": { animal: "Owl", job: "Navigator", file: "data-structures-algorithms.svg" },
  "code-craft": { animal: "Beaver", job: "Builder", file: "code-craft.svg" },
  "design-architecture": { animal: "Spider", job: "Bridge architect", file: "design-architecture.svg" },
  backend: { animal: "Ant", job: "Porter", file: "backend.svg" },
  "data-storage": { animal: "Squirrel", job: "Storekeeper", file: "data-storage.svg" },
  testing: { animal: "Meerkat", job: "Lookout", file: "testing.svg" },
  "delivery-ops": { animal: "Husky", job: "Sled runner", file: "delivery-ops.svg" },
  frontend: { animal: "Chameleon", job: "Signaller", file: "frontend.svg" },
  wanderer: { animal: "Fox", job: "Backpacker", file: "wanderer.svg" },
} as const;

export type MascotId = keyof typeof MASCOTS;

export function mascot(id: string) {
  const m = MASCOTS[id as MascotId] ?? MASCOTS.wanderer;
  return { ...m, src: `${import.meta.env.BASE_URL}mascots/${m.file}` };
}
