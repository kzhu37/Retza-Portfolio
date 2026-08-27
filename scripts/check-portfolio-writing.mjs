import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const ROOT = process.cwd()
const INCLUDED_EXTENSIONS = new Set(['.md', '.html', '.txt'])
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'out'])
const FORBIDDEN = new Map([
  ['\u2010', 'U+2010 HYPHEN'],
  ['\u2011', 'U+2011 NON-BREAKING HYPHEN'],
  ['\u2012', 'U+2012 FIGURE DASH'],
  ['\u2013', 'U+2013 EN DASH'],
  ['\u2014', 'U+2014 EM DASH'],
  ['\u2015', 'U+2015 HORIZONTAL BAR'],
  ['\u2e3a', 'U+2E3A TWO-EM DASH'],
  ['\u2e3b', 'U+2E3B THREE-EM DASH'],
])

async function collect(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(path))
    else if (INCLUDED_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(path)
  }
  return files
}

const failures = []
for (const path of await collect(ROOT)) {
  const text = await readFile(path, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const [character, label] of FORBIDDEN) {
      if (line.includes(character)) {
        failures.push(`${relative(ROOT, path)}:${index + 1}: ${label}`)
      }
    }
  })
}

if (failures.length) {
  console.error('Portfolio writing contains forbidden long-dash characters:')
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Portfolio writing check passed')
