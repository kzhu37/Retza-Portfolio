const normalize = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

const inferRole = element => {
  const explicit = element.getAttribute?.('role')
  if (explicit) return explicit
  const tag = element.tagName?.toLowerCase()
  if (tag === 'button') return 'button'
  if (tag === 'a') return 'link'
  if (tag === 'select') return 'combobox'
  if (tag === 'textarea') return 'textbox'
  if (tag === 'input') {
    const type = (element.getAttribute('type') || 'text').toLowerCase()
    if (['button', 'submit', 'reset'].includes(type)) return 'button'
    if (type === 'checkbox') return 'checkbox'
    if (type === 'range') return 'slider'
    return 'textbox'
  }
  return tag || 'generic'
}

const accessibleName = element => {
  const aria = element.getAttribute?.('aria-label')
  if (aria) return aria.trim()
  const labelledBy = element.getAttribute?.('aria-labelledby')
  if (labelledBy) {
    const label = labelledBy.split(/\s+/).map(id => element.ownerDocument?.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ')
    if (label) return label
  }
  if (element.labels?.length) {
    const label = Array.from(element.labels).map(item => item.textContent?.trim()).filter(Boolean).join(' ')
    if (label) return label
  }
  return (element.getAttribute?.('placeholder') || element.textContent || '').trim()
}

export function candidateFromElement(element) {
  return {
    element,
    name: accessibleName(element),
    role: inferRole(element),
    app: element.getAttribute?.('data-retza-app') || null,
    window: element.getAttribute?.('data-retza-window') || null,
    semanticId: element.getAttribute?.('data-retza-id') || null,
    disabled: Boolean(element.disabled) || element.getAttribute?.('aria-disabled') === 'true',
    hidden: Boolean(element.hidden) || element.getAttribute?.('aria-hidden') === 'true',
  }
}

export function selectSemanticCandidate(target, candidates) {
  if (!target || target.zone !== 'ui_element') {
    return { ok: false, code: 'invalid_target', message: 'This step does not identify a sandbox control.' }
  }
  if (!target.name || typeof target.name !== 'string') {
    return { ok: false, code: 'invalid_target', message: 'This target is missing an accessible control name.' }
  }

  const requestedName = normalize(target.name)
  const requestedRole = normalize(target.role)
  const requestedApp = normalize(target.app)
  const requestedWindow = normalize(target.window)
  const requestedId = normalize(target.semanticId)

  const nameMatches = candidates.filter(candidate => normalize(candidate.name) === requestedName)
  if (!nameMatches.length) {
    return { ok: false, code: 'not_found', message: "Retza couldn't verify that control in the demo environment, so it won't point to a location." }
  }

  let matches = nameMatches.filter(candidate => {
    if (requestedId && normalize(candidate.semanticId) !== requestedId) return false
    if (requestedRole && normalize(candidate.role) !== requestedRole) return false
    if (requestedApp && normalize(candidate.app) !== requestedApp) return false
    if (requestedWindow && normalize(candidate.window) !== requestedWindow) return false
    return true
  })

  if (!matches.length) {
    return { ok: false, code: 'not_found', message: "Retza found similarly named controls, but none matched the verified semantic target." }
  }

  const visible = matches.filter(candidate => !candidate.hidden)
  if (!visible.length) {
    return { ok: false, code: 'not_visible', message: 'That control exists in the demo, but it is not visible right now.' }
  }

  const actionable = target.action === 'look' ? visible : visible.filter(candidate => !candidate.disabled)
  if (!actionable.length) {
    return { ok: false, code: 'not_actionable', message: 'That control is visible, but it is not currently available for this action.' }
  }

  matches = actionable
  if (matches.length !== 1) {
    return { ok: false, code: 'ambiguous', message: "Retza found more than one matching control, so it won't guess which one you meant." }
  }

  return { ok: true, candidate: matches[0] }
}

function isActuallyVisible(element, root) {
  if (!element?.isConnected || !root.contains(element)) return false
  const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element)
  if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) return false
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function resolveTarget(root, target) {
  if (!root) return { ok: false, code: 'window_unavailable', message: 'The demo computer is not available.' }
  const elements = Array.from(root.querySelectorAll('[data-retza-control]'))
  const candidates = elements.map(candidateFromElement).map(candidate => ({
    ...candidate,
    hidden: candidate.hidden || !isActuallyVisible(candidate.element, root),
  }))
  const result = selectSemanticCandidate(target, candidates)
  if (!result.ok) return result
  return {
    ok: true,
    element: result.candidate.element,
    bounds: result.candidate.element.getBoundingClientRect(),
    evidence: 'sandbox_dom_semantics',
  }
}

export function createHighlightController(root, ring, onLost = () => {}) {
  let activeTarget = null
  let activeElement = null
  let observer = null
  let resizeObserver = null
  let frame = 0

  const clear = () => {
    activeTarget = null
    activeElement = null
    ring.hidden = true
    ring.removeAttribute('data-active')
    observer?.disconnect()
    resizeObserver?.disconnect()
    observer = null
    resizeObserver = null
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  const position = () => {
    if (!activeTarget) return
    const resolved = resolveTarget(root, activeTarget)
    if (!resolved.ok) {
      const failure = resolved
      clear()
      onLost(failure)
      return
    }
    activeElement = resolved.element
    const rootRect = root.getBoundingClientRect()
    const rect = resolved.bounds
    ring.hidden = false
    ring.dataset.active = 'true'
    ring.style.left = `${rect.left - rootRect.left + root.scrollLeft - 6}px`
    ring.style.top = `${rect.top - rootRect.top + root.scrollTop - 6}px`
    ring.style.width = `${rect.width + 12}px`
    ring.style.height = `${rect.height + 12}px`
  }

  const schedule = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      position()
    })
  }

  const show = target => {
    clear()
    const resolved = resolveTarget(root, target)
    if (!resolved.ok) return resolved
    activeTarget = { ...target }
    activeElement = resolved.element
    position()

    observer = new MutationObserver(schedule)
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'aria-hidden', 'aria-disabled', 'style', 'class'] })
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(schedule)
      resizeObserver.observe(root)
      resizeObserver.observe(activeElement)
    }
    window.addEventListener('resize', schedule, { passive: true })
    root.addEventListener('scroll', schedule, { passive: true })
    return { ok: true, evidence: resolved.evidence }
  }

  const destroy = () => {
    window.removeEventListener('resize', schedule)
    root.removeEventListener('scroll', schedule)
    clear()
  }

  return { show, clear, destroy, reposition: schedule }
}
