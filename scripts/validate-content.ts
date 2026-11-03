import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateContent } from '../src/validate.ts'

const dir = join(import.meta.dirname, '..', 'content')
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((name) => ({ name, data: JSON.parse(readFileSync(join(dir, name), 'utf8')) }))

const { errors, warnings } = validateContent(files)
for (const w of warnings) console.warn(`warning: ${w}`)
for (const e of errors) console.error(`error: ${e}`)
console.log(`${files.length} file(s), ${errors.length} error(s), ${warnings.length} warning(s)`)
if (errors.length) process.exit(1)
