import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EXAMPLE_IDS, SCENARIOS, matchScenario } from '../lib/scenarios.js'

const browserSourceFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'lib/scenarios.js',
  'lib/target-resolver.js',
]

test('browser demo invariants stay deterministic and free of long dash characters', async () => {
  for (const id of EXAMPLE_IDS) {
    const scenario = SCENARIOS[id]
    assert.ok(scenario, `Missing scenario for example id: ${id}`)
    assert.ok(scenario.steps.length > 0, `Example scenario has no walkthrough steps: ${id}`)
    assert.equal(matchScenario(scenario.label)?.id, id, `Example label did not resolve deterministically: ${scenario.label}`)
    assert.equal(matchScenario(`  ${scenario.label.toUpperCase()}  `)?.id, id, `Normalized example label did not resolve deterministically: ${scenario.label}`)
  }

  const violations = []
  for (const relativePath of browserSourceFiles) {
    const url = new URL(`../${relativePath}`, import.meta.url)
    const content = await readFile(url, 'utf8')
    content.split('\n').forEach((line, index) => {
      if (/[\u2013\u2014]/u.test(line)) violations.push(`${relativePath}:${index + 1}`)
    })
  }
  assert.deepEqual(violations, [], `Long dash characters found in browser demo source: ${violations.join(', ')}`)
})

test('Windows Update phrasing resolves deterministically', () => {
  for (const query of ['Windows Update', 'Windows updates', 'Check for updates', 'Check for Windows updates']) {
    assert.equal(matchScenario(query)?.id, 'windows_update', `Expected Windows Update scenario for: ${query}`)
  }
})
