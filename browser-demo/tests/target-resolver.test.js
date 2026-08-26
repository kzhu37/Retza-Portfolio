import test from 'node:test'
import assert from 'node:assert/strict'
import { selectSemanticCandidate } from '../lib/target-resolver.js'

const target = overrides => ({ zone:'ui_element', app:'Demo Computer', action:'click', name:'Bluetooth', role:'button', window:'Settings', semanticId:'bluetooth-toggle', ...overrides })
const candidate = overrides => ({ name:'Bluetooth', role:'button', app:'Demo Computer', window:'Settings', semanticId:'bluetooth-toggle', disabled:false, hidden:false, ...overrides })

test('selects one exact semantic candidate', () => {
  const result = selectSemanticCandidate(target({}), [candidate({})])
  assert.equal(result.ok, true)
  assert.equal(result.candidate.semanticId, 'bluetooth-toggle')
})

test('rejects a missing target instead of guessing', () => {
  const result = selectSemanticCandidate(target({ name:'Wi-Fi', semanticId:'wifi-toggle' }), [candidate({})])
  assert.deepEqual({ ok:result.ok, code:result.code }, { ok:false, code:'not_found' })
})

test('rejects ambiguous matches', () => {
  const looseTarget = target({ semanticId:null })
  const result = selectSemanticCandidate(looseTarget, [candidate({ semanticId:'one' }), candidate({ semanticId:'two' })])
  assert.deepEqual({ ok:result.ok, code:result.code }, { ok:false, code:'ambiguous' })
})

test('rejects hidden controls', () => {
  const result = selectSemanticCandidate(target({}), [candidate({ hidden:true })])
  assert.deepEqual({ ok:result.ok, code:result.code }, { ok:false, code:'not_visible' })
})

test('rejects disabled controls for click actions', () => {
  const result = selectSemanticCandidate(target({}), [candidate({ disabled:true })])
  assert.deepEqual({ ok:result.ok, code:result.code }, { ok:false, code:'not_actionable' })
})

test('allows disabled controls for look-only guidance', () => {
  const result = selectSemanticCandidate(target({ action:'look' }), [candidate({ disabled:true })])
  assert.equal(result.ok, true)
})

test('requires the role, app, window, and semantic id when supplied', () => {
  const result = selectSemanticCandidate(target({}), [candidate({ role:'checkbox' })])
  assert.deepEqual({ ok:result.ok, code:result.code }, { ok:false, code:'not_found' })
})

test('rejects targets that are not sandbox UI elements', () => {
  const result = selectSemanticCandidate({ zone:'taskbar', name:'Search', action:'click' }, [candidate({})])
  assert.deepEqual({ ok:result.ok, code:result.code }, { ok:false, code:'invalid_target' })
})
