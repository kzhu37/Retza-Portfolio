import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32') {
  console.error('The live UI Automation smoke test requires a normal Windows desktop session.')
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vitest = resolve(root, 'node_modules', 'vitest', 'vitest.mjs')
const child = spawn(
  process.execPath,
  [vitest, 'run', 'src/main/show-me/windows-uia.test.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, RETZA_LIVE_UIA: '1' },
  },
)

child.on('error', error => {
  console.error(`Could not start the live UI Automation smoke test: ${error.message}`)
  process.exit(1)
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
