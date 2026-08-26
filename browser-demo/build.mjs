import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
await rm(dist, { recursive: true, force: true })
await mkdir(join(dist, 'lib'), { recursive: true })
for (const file of ['index.html', 'styles.css', 'app.js']) await cp(join(here, file), join(dist, file))
await cp(join(here, 'lib'), join(dist, 'lib'), { recursive: true })
console.log('Retza browser demo built to browser-demo/dist')
