import type {
  StepPayload,
  TargetAction,
  TargetPayload,
  TargetVisibility,
  TargetZone,
} from '../shared/contracts'

/**
 * Limits are deliberately kept here, next to the untrusted-data boundary. This
 * prevents a model response from creating an enormous chat/history entry while
 * still leaving ample room for useful guidance.
 */
export const ASSISTANT_RESPONSE_LIMITS = Object.freeze({
  rawResponse: 100_000,
  message: 6_000,
  clarification: 1_000,
  instruction: 1_200,
  steps: 12,
  app: 120,
  hint: 500,
  name: 160,
  role: 80,
  window: 160,
})

const TARGET_ZONES: ReadonlySet<TargetZone> = new Set([
  'taskbar',
  'desktop',
  'start_menu',
  'screen_center',
  'top_right',
  'browser_address_bar',
  'ui_element',
  'none',
])

const TARGET_ACTIONS: ReadonlySet<TargetAction> = new Set(['click', 'look', 'type'])
const TARGET_VISIBILITIES: ReadonlySet<TargetVisibility> = new Set([
  'visible_now',
  'after_navigation',
  'unknown',
])
const RESPONSE_KINDS = new Set(['message', 'walkthrough', 'clarification'])

const INERT_TARGET: TargetPayload = Object.freeze({
  zone: 'none',
  app: null,
  action: 'look',
  hint: null,
})

export interface ParsedAssistantResponse {
  message: string
  steps?: StepPayload[]
  clarify?: string
  target?: TargetPayload
}

export type AssistantResponseParseResult =
  | { ok: true; value: ParsedAssistantResponse }
  | { ok: false; error: string }

interface MarkdownBlock {
  text: string
  language: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null

  // NUL and the remaining non-whitespace C0 controls have no useful place in
  // UI copy or semantic accessibility fields.
  const cleaned = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()

  if (!cleaned) return null
  return cleaned.length <= maximum ? cleaned : cleaned.slice(0, maximum).trimEnd()
}

function optionalNullableString(
  record: Record<string, unknown>,
  key: string,
  maximum: number,
): { valid: true; value: string | null | undefined } | { valid: false } {
  const value = record[key]
  if (value === undefined) return { valid: true, value: undefined }
  if (value === null) return { valid: true, value: null }
  if (typeof value !== 'string') return { valid: false }

  const normalized = boundedString(value, maximum)
  // Empty optional semantic fields are equivalent to their absence, rather
  // than a reason to trust an otherwise unusable target.
  return { valid: true, value: normalized }
}

function stripOuterMarkdownFence(raw: string): MarkdownBlock {
  const trimmed = raw.replace(/^\uFEFF/, '').trim()
  const match = trimmed.match(/^```([a-z0-9_-]*)[ \t]*\r?\n([\s\S]*?)\r?\n?```$/i)
  if (!match) return { text: trimmed, language: null }

  return {
    text: match[2].trim(),
    language: match[1] ? match[1].toLowerCase() : '',
  }
}

function stripInnerJsonFence(raw: string): string {
  const block = stripOuterMarkdownFence(raw)
  return block.language === null || block.language === '' || block.language === 'json'
    ? block.text
    : raw.trim()
}

function decodeXmlText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
}

/**
 * Validate an untrusted semantic target. There are intentionally no coercions:
 * a misspelled enum or non-string field disables targeting instead of becoming
 * a value that could later be treated as trustworthy by Show Me.
 */
function parseTarget(value: unknown): TargetPayload | null {
  if (!isRecord(value) || typeof value.zone !== 'string' || !TARGET_ZONES.has(value.zone as TargetZone)) {
    return null
  }

  const zone = value.zone as TargetZone
  if (zone === 'none') return { ...INERT_TARGET }

  if (typeof value.action !== 'string' || !TARGET_ACTIONS.has(value.action as TargetAction)) {
    return null
  }

  const app = optionalNullableString(value, 'app', ASSISTANT_RESPONSE_LIMITS.app)
  const hint = optionalNullableString(value, 'hint', ASSISTANT_RESPONSE_LIMITS.hint)
  const name = optionalNullableString(value, 'name', ASSISTANT_RESPONSE_LIMITS.name)
  const role = optionalNullableString(value, 'role', ASSISTANT_RESPONSE_LIMITS.role)
  const window = optionalNullableString(value, 'window', ASSISTANT_RESPONSE_LIMITS.window)
  if (!app.valid || !hint.valid || !name.valid || !role.valid || !window.valid) return null

  const visibilityValue = value.visibility
  if (
    visibilityValue !== undefined &&
    (typeof visibilityValue !== 'string' ||
      !TARGET_VISIBILITIES.has(visibilityValue as TargetVisibility))
  ) {
    return null
  }

  // A hint describes a landmark, not element identity. Exact UI Automation
  // matching requires a literal accessible/visible name.
  if (zone === 'ui_element' && !name.value) return null

  const target: TargetPayload = {
    zone,
    app: app.value ?? null,
    action: value.action as TargetAction,
    hint: hint.value ?? null,
  }

  if (name.value !== undefined) target.name = name.value
  if (role.value !== undefined) target.role = role.value
  if (window.value !== undefined) target.window = window.value
  if (visibilityValue !== undefined) target.visibility = visibilityValue as TargetVisibility
  return target
}

function parseSteps(value: unknown): StepPayload[] {
  if (!Array.isArray(value)) return []

  const steps: StepPayload[] = []
  for (const candidate of value) {
    if (steps.length >= ASSISTANT_RESPONSE_LIMITS.steps) break
    if (!isRecord(candidate)) continue

    const instruction = boundedString(candidate.instruction, ASSISTANT_RESPONSE_LIMITS.instruction)
    if (!instruction) continue

    // Preserve safe instructional copy even when the accompanying target is
    // malformed. An inert target makes the step readable but not highlightable.
    const target = parseTarget(candidate.target) ?? { ...INERT_TARGET }
    const step: StepPayload = {
      stepNumber: steps.length + 1,
      instruction,
      target,
    }
    if (typeof candidate.prereq === 'boolean') step.prereq = candidate.prereq
    steps.push(step)
  }

  return steps
}

function invalid(error: string): AssistantResponseParseResult {
  return { ok: false, error }
}

function parseJsonResponse(value: unknown): AssistantResponseParseResult {
  if (!isRecord(value)) return invalid('Assistant response JSON must be an object.')
  if (typeof value.kind !== 'string' || !RESPONSE_KINDS.has(value.kind)) {
    return invalid('Assistant response has an unsupported or missing kind.')
  }

  if (value.kind === 'clarification') {
    const clarify =
      boundedString(value.clarify, ASSISTANT_RESPONSE_LIMITS.clarification) ??
      boundedString(value.message, ASSISTANT_RESPONSE_LIMITS.clarification)
    if (!clarify) return invalid('Assistant clarification did not contain a safe message.')
    return { ok: true, value: { message: clarify, clarify } }
  }

  const message = boundedString(value.message, ASSISTANT_RESPONSE_LIMITS.message)
  if (!message) return invalid('Assistant response did not contain a safe message.')

  if (value.kind === 'walkthrough') {
    const steps = parseSteps(value.steps)
    return steps.length
      ? { ok: true, value: { message, steps } }
      : { ok: true, value: { message } }
  }

  const target = parseTarget(value.target)
  return target && target.zone !== 'none'
    ? { ok: true, value: { message, target } }
    : { ok: true, value: { message } }
}

function extractXmlElement(inner: string, element: string): string | null {
  const match = inner.match(new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`, 'i'))
  return match ? match[1] : null
}

function parseLegacyXml(text: string): AssistantResponseParseResult | null {
  const responseMatch = text.match(/<response\b[^>]*>([\s\S]*?)<\/response>/i)
  if (!responseMatch) return null

  const inner = responseMatch[1]
  const rawClarify = extractXmlElement(inner, 'clarify')
  if (rawClarify !== null) {
    const clarify = boundedString(decodeXmlText(rawClarify), ASSISTANT_RESPONSE_LIMITS.clarification)
    return clarify
      ? { ok: true, value: { message: clarify, clarify } }
      : invalid('Assistant clarification did not contain a safe message.')
  }

  const rawMessage = extractXmlElement(inner, 'message')
  const message = rawMessage === null
    ? null
    : boundedString(decodeXmlText(rawMessage), ASSISTANT_RESPONSE_LIMITS.message)
  if (!message) return invalid('Assistant response did not contain a safe message.')

  const rawSteps = extractXmlElement(inner, 'steps')
  if (rawSteps !== null) {
    try {
      const steps = parseSteps(JSON.parse(stripInnerJsonFence(rawSteps)) as unknown)
      return steps.length
        ? { ok: true, value: { message, steps } }
        : { ok: true, value: { message } }
    } catch {
      // The message remains useful; malformed embedded targeting data does not.
      return { ok: true, value: { message } }
    }
  }

  const rawTarget = extractXmlElement(inner, 'target')
  if (rawTarget !== null) {
    try {
      const target = parseTarget(JSON.parse(stripInnerJsonFence(rawTarget)) as unknown)
      if (target && target.zone !== 'none') return { ok: true, value: { message, target } }
    } catch {
      // Keep the validated message and discard the malformed target.
    }
  }

  return { ok: true, value: { message } }
}

/**
 * Parse a model response without trusting it to conform to TypeScript types.
 * New responses use JSON; the XML envelope used by earlier versions and plain
 * conversational text remain supported while callers migrate.
 */
export function parseAssistantResponse(raw: unknown): AssistantResponseParseResult {
  if (typeof raw !== 'string') return invalid('Assistant response must be text.')
  if (raw.length > ASSISTANT_RESPONSE_LIMITS.rawResponse) {
    return invalid('Assistant response exceeded the maximum allowed length.')
  }

  const block = stripOuterMarkdownFence(raw)
  const text = block.text
  if (!text) return invalid('Assistant response was empty.')

  const looksLikeJson = text.startsWith('{') || text.startsWith('[') || block.language === 'json'
  if (looksLikeJson) {
    try {
      return parseJsonResponse(JSON.parse(text) as unknown)
    } catch {
      return invalid('Assistant response was not valid JSON.')
    }
  }

  const legacy = parseLegacyXml(text)
  if (legacy) return legacy

  // A broken response envelope should never be shown to a user as raw markup.
  if (/<\/?response\b/i.test(text) || block.language === 'xml') {
    return invalid('Assistant response contained malformed XML.')
  }

  const message = boundedString(decodeXmlText(text), ASSISTANT_RESPONSE_LIMITS.message)
  return message
    ? { ok: true, value: { message } }
    : invalid('Assistant response did not contain a safe message.')
}

/**
 * Stable, complete model-history representation. In particular, walkthrough
 * steps retain their semantic targets so a later "Show me" can refer to what
 * the assistant actually proposed instead of seeing only its intro sentence.
 */
export function serializeAssistantResponseForHistory(response: ParsedAssistantResponse): string {
  const clarify = boundedString(response.clarify, ASSISTANT_RESPONSE_LIMITS.clarification)
  if (clarify) {
    return JSON.stringify({ kind: 'clarification', message: clarify })
  }

  const message = boundedString(response.message, ASSISTANT_RESPONSE_LIMITS.message)
  if (!message) return ''

  const steps = parseSteps(response.steps)
  if (steps.length) {
    return JSON.stringify({ kind: 'walkthrough', message, steps })
  }

  const target = parseTarget(response.target)
  if (target && target.zone !== 'none') {
    return JSON.stringify({ kind: 'message', message, target })
  }

  return JSON.stringify({ kind: 'message', message })
}
