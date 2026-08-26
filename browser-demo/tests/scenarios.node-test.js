import test from 'node:test'
import assert from 'node:assert/strict'
import { EXAMPLE_IDS, SCENARIOS, matchScenario } from '../lib/scenarios.js'

test('every built-in example label resolves to its own deterministic scenario', () => {
  for (const id of EXAMPLE_IDS) {
    const scenario = SCENARIOS[id]
    assert.ok(scenario, `Missing scenario for example id: ${id}`)
    assert.ok(scenario.steps.length > 0, `Example scenario has no walkthrough steps: ${id}`)
    assert.equal(matchScenario(scenario.label)?.id, id, `Example label did not resolve deterministically: ${scenario.label}`)
    assert.equal(matchScenario(`  ${scenario.label.toUpperCase()}  `)?.id, id, `Normalized example label did not resolve deterministically: ${scenario.label}`)
  }
})

test('Windows Update phrasing resolves deterministically', () => {
  for (const query of ['Windows Update', 'Windows updates', 'Check for updates', 'Check for Windows updates']) {
    assert.equal(matchScenario(query)?.id, 'windows_update', `Expected Windows Update scenario for: ${query}`)
  }
})
