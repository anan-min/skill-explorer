import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateContent } from "../src/validate.ts";

// Real content, and the dev-only placeholder topics, each checked on their own.
let failed = false;
for (const folder of ["content", "dev-content"]) {
  const dir = join(import.meta.dirname, "..", folder);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((name) => ({ name, data: JSON.parse(readFileSync(join(dir, name), "utf8")) as unknown }));

  const { errors, warnings } = validateContent(files);
  for (const w of warnings) console.error(`warning: ${folder}/${w}`);
  for (const e of errors) console.error(`error: ${folder}/${e}`);
  console.error(`${folder}: ${files.length} file(s), ${errors.length} error(s), ${warnings.length} warning(s)`);
  failed ||= errors.length > 0;
}
if (failed) process.exit(1);
