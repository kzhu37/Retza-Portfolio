export type ShowMePhase = 'idle' | 'locating' | 'rendered' | 'dismissing' | 'returning'

/**
 * Small, deterministic state machine for the asynchronous Show Me windows.
 * Operation IDs prevent a cancelled locator from publishing a late result.
 */
export class ShowMeLifecycle {
  private currentPhase: ShowMePhase = 'idle'
  private currentOperation = 0

  get phase(): ShowMePhase {
    return this.currentPhase
  }

  get operationId(): number {
    return this.currentOperation
  }

  begin(): { ok: true; operation: number } | { ok: false; phase: ShowMePhase } {
    if (this.currentPhase !== 'idle') return { ok: false, phase: this.currentPhase }
    this.currentOperation++
    this.currentPhase = 'locating'
    return { ok: true, operation: this.currentOperation }
  }

  isCurrent(operation: number): boolean {
    return operation === this.currentOperation
  }

  markRendered(operation: number): boolean {
    if (!this.isCurrent(operation) || this.currentPhase !== 'locating') return false
    this.currentPhase = 'rendered'
    return true
  }

  requestDismiss(): boolean {
    if (this.currentPhase !== 'rendered') return false
    this.currentPhase = 'dismissing'
    return true
  }

  startReturning(): boolean {
    if (this.currentPhase !== 'rendered' && this.currentPhase !== 'dismissing') return false
    this.currentPhase = 'returning'
    return true
  }

  finishReturning(): boolean {
    if (this.currentPhase !== 'returning') return false
    this.currentPhase = 'idle'
    return true
  }

  /** Cancels any phase and invalidates every in-flight async continuation. */
  reset(): void {
    this.currentOperation++
    this.currentPhase = 'idle'
  }
}
