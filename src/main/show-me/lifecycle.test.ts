import { describe, expect, it } from 'vitest'
import { ShowMeLifecycle } from './lifecycle'

describe('ShowMeLifecycle', () => {
  it('runs the complete locate, render, dismiss, and return sequence', () => {
    const lifecycle = new ShowMeLifecycle()
    const begun = lifecycle.begin()
    expect(begun.ok).toBe(true)
    if (!begun.ok) return
    expect(lifecycle.phase).toBe('locating')
    expect(lifecycle.markRendered(begun.operation)).toBe(true)
    expect(lifecycle.requestDismiss()).toBe(true)
    expect(lifecycle.startReturning()).toBe(true)
    expect(lifecycle.finishReturning()).toBe(true)
    expect(lifecycle.phase).toBe('idle')
  })

  it('rejects a second request while any guide is active', () => {
    const lifecycle = new ShowMeLifecycle()
    expect(lifecycle.begin().ok).toBe(true)
    expect(lifecycle.begin()).toEqual({ ok: false, phase: 'locating' })
  })

  it('cancellation invalidates late work and allows recovery', () => {
    const lifecycle = new ShowMeLifecycle()
    const first = lifecycle.begin()
    if (!first.ok) throw new Error('fixture failed')
    lifecycle.reset()
    expect(lifecycle.isCurrent(first.operation)).toBe(false)
    expect(lifecycle.markRendered(first.operation)).toBe(false)
    const retry = lifecycle.begin()
    expect(retry.ok).toBe(true)
    if (retry.ok) expect(retry.operation).toBeGreaterThan(first.operation)
  })

  it('ignores renderer acknowledgements and timeout completions in the wrong phase', () => {
    const lifecycle = new ShowMeLifecycle()
    expect(lifecycle.requestDismiss()).toBe(false)
    expect(lifecycle.startReturning()).toBe(false)
    expect(lifecycle.finishReturning()).toBe(false)
  })
})
