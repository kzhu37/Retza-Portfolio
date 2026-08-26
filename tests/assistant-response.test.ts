import { describe, expect, it } from 'vitest'

import {
  ASSISTANT_RESPONSE_LIMITS,
  parseAssistantResponse,
  serializeAssistantResponseForHistory,
  type ParsedAssistantResponse,
} from '../src/main/assistant-response'

function parseValue(raw: string): ParsedAssistantResponse {
  const result = parseAssistantResponse(raw)
  expect(result.ok, result.ok ? undefined : result.error).toBe(true)
  if (!result.ok) throw new Error(result.error)
  return result.value
}

describe('parseAssistantResponse JSON format', () => {
  it('parses a plain message from a JSON markdown block', () => {
    expect(parseValue('```json\n{"kind":"message","message":"  Hello there!  "}\n```')).toEqual({
      message: 'Hello there!',
    })
  })

  it('parses a walkthrough and normalizes numbering after dropping unusable steps', () => {
    const value = parseValue(JSON.stringify({
      kind: 'walkthrough',
      message: 'Open the settings:',
      steps: [
        {
          stepNumber: 88,
          instruction: 'Open Start.',
          target: {
            zone: 'start_menu',
            app: null,
            action: 'click',
            hint: 'the Windows logo',
          },
        },
        { stepNumber: 89, instruction: 42, target: null },
        {
          stepNumber: -9,
          instruction: 'Choose Bluetooth.',
          prereq: true,
          target: {
            zone: 'ui_element',
            app: 'Settings',
            action: 'click',
            hint: 'the Bluetooth & devices row',
            name: 'Bluetooth & devices',
            role: 'ListItem',
            window: 'Settings',
            visibility: 'visible_now',
          },
        },
      ],
    }))

    expect(value.steps).toEqual([
      {
        stepNumber: 1,
        instruction: 'Open Start.',
        target: {
          zone: 'start_menu',
          app: null,
          action: 'click',
          hint: 'the Windows logo',
        },
      },
      {
        stepNumber: 2,
        instruction: 'Choose Bluetooth.',
        prereq: true,
        target: {
          zone: 'ui_element',
          app: 'Settings',
          action: 'click',
          hint: 'the Bluetooth & devices row',
          name: 'Bluetooth & devices',
          role: 'ListItem',
          window: 'Settings',
          visibility: 'visible_now',
        },
      },
    ])
  })

  it('accepts each whitelisted target zone, action, and visibility', () => {
    const zones = [
      'taskbar',
      'desktop',
      'start_menu',
      'screen_center',
      'top_right',
      'browser_address_bar',
      'ui_element',
      'none',
    ] as const
    const actions = ['click', 'look', 'type'] as const
    const visibilities = ['visible_now', 'after_navigation', 'unknown'] as const

    for (const [index, zone] of zones.entries()) {
      const value = parseValue(JSON.stringify({
        kind: 'walkthrough',
        message: 'Do this:',
        steps: [{
          instruction: `Step ${index + 1}`,
          target: {
            zone,
            app: null,
            action: actions[index % actions.length],
            hint: zone === 'none' ? null : 'visible landmark',
            name: zone === 'ui_element' ? 'Save' : undefined,
            visibility: visibilities[index % visibilities.length],
          },
        }],
      }))

      expect(value.steps?.[0].target.zone).toBe(zone)
      if (zone !== 'none') {
        expect(actions).toContain(value.steps?.[0].target.action)
        expect(visibilities).toContain(value.steps?.[0].target.visibility)
      }
    }
  })

  it('turns malformed or unsafe step targets into inert targets', () => {
    const invalidTargets = [
      { zone: 'moon', app: null, action: 'click', hint: 'there' },
      { zone: 'taskbar', app: null, action: 'execute', hint: 'there' },
      { zone: 'taskbar', app: { name: 'Edge' }, action: 'click', hint: 'there' },
      { zone: 'taskbar', app: null, action: 'click', hint: 'there', visibility: 'definitely' },
      { zone: 'ui_element', app: null, action: 'click', hint: null },
      'not an object',
    ]

    const value = parseValue(JSON.stringify({
      kind: 'walkthrough',
      message: 'Try these safe instructions:',
      steps: invalidTargets.map((target, index) => ({
        stepNumber: 100 + index,
        instruction: `Instruction ${index + 1}`,
        target,
      })),
    }))

    expect(value.steps).toHaveLength(invalidTargets.length)
    expect(value.steps?.map(step => step.target)).toEqual(
      invalidTargets.map(() => ({ zone: 'none', app: null, action: 'look', hint: null })),
    )
  })

  it('caps step count and all user-visible and semantic string fields', () => {
    const over = (limit: number) => 'x'.repeat(limit + 100)
    const value = parseValue(JSON.stringify({
      kind: 'walkthrough',
      message: over(ASSISTANT_RESPONSE_LIMITS.message),
      steps: Array.from({ length: 20 }, (_, index) => ({
        stepNumber: index + 50,
        instruction: index === 0
          ? over(ASSISTANT_RESPONSE_LIMITS.instruction)
          : `Instruction ${index + 1}`,
        target: {
          zone: 'ui_element',
          app: index === 0 ? over(ASSISTANT_RESPONSE_LIMITS.app) : 'Settings',
          action: 'look',
          hint: index === 0 ? over(ASSISTANT_RESPONSE_LIMITS.hint) : 'the named control',
          name: index === 0 ? over(ASSISTANT_RESPONSE_LIMITS.name) : `Control ${index + 1}`,
          role: index === 0 ? over(ASSISTANT_RESPONSE_LIMITS.role) : 'Button',
          window: index === 0 ? over(ASSISTANT_RESPONSE_LIMITS.window) : 'Settings',
          visibility: 'unknown',
        },
      })),
    }))

    expect(value.message).toHaveLength(ASSISTANT_RESPONSE_LIMITS.message)
    expect(value.steps).toHaveLength(ASSISTANT_RESPONSE_LIMITS.steps)
    expect(value.steps?.[0].instruction).toHaveLength(ASSISTANT_RESPONSE_LIMITS.instruction)
    expect(value.steps?.[0].target.app).toHaveLength(ASSISTANT_RESPONSE_LIMITS.app)
    expect(value.steps?.[0].target.hint).toHaveLength(ASSISTANT_RESPONSE_LIMITS.hint)
    expect(value.steps?.[0].target.name).toHaveLength(ASSISTANT_RESPONSE_LIMITS.name)
    expect(value.steps?.[0].target.role).toHaveLength(ASSISTANT_RESPONSE_LIMITS.role)
    expect(value.steps?.[0].target.window).toHaveLength(ASSISTANT_RESPONSE_LIMITS.window)
    expect(value.steps?.map(step => step.stepNumber)).toEqual(
      Array.from({ length: ASSISTANT_RESPONSE_LIMITS.steps }, (_, index) => index + 1),
    )
  })

  it('parses both clarification spellings and emits one canonical value', () => {
    expect(parseValue('{"kind":"clarification","message":"Which browser do you use?"}')).toEqual({
      message: 'Which browser do you use?',
      clarify: 'Which browser do you use?',
    })
    expect(parseValue('{"kind":"clarification","clarify":"Is Settings open?"}')).toEqual({
      message: 'Is Settings open?',
      clarify: 'Is Settings open?',
    })
  })

  it('preserves a validated legacy single target on a JSON message', () => {
    expect(parseValue(JSON.stringify({
      kind: 'message',
      message: 'Click the address bar.',
      target: {
        zone: 'browser_address_bar',
        app: 'Edge',
        action: 'click',
        hint: 'the long box at the top',
      },
    }))).toMatchObject({
      target: { zone: 'browser_address_bar', action: 'click' },
    })
  })

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['{"kind":"message","message":""}', 'safe message'],
    ['{"kind":"teleport","message":"hello"}', 'kind'],
    ['{"kind":"message",', 'valid JSON'],
    ['[]', 'object'],
  ])('returns a clear invalid result for %j', (raw, errorFragment) => {
    const result = parseAssistantResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.toLowerCase()).toContain(errorFragment.toLowerCase())
  })

  it('rejects non-text and oversized raw responses before parsing', () => {
    const nonText = parseAssistantResponse({ kind: 'message', message: 'hi' })
    expect(nonText.ok).toBe(false)

    const oversized = parseAssistantResponse('x'.repeat(ASSISTANT_RESPONSE_LIMITS.rawResponse + 1))
    expect(oversized.ok).toBe(false)
    if (!oversized.ok) expect(oversized.error).toContain('maximum')
  })
})

describe('parseAssistantResponse legacy compatibility', () => {
  it('parses XML with embedded fenced step JSON', () => {
    const value = parseValue(`
      \`\`\`xml
      <response>
        <message>Here is how to open Settings:</message>
        <steps>\`\`\`json
          [{
            "stepNumber": 7,
            "instruction": "Click Start.",
            "target": {
              "zone": "start_menu",
              "app": null,
              "action": "click",
              "hint": "the Windows logo"
            }
          }]
        \`\`\`</steps>
      </response>
      \`\`\`
    `)

    expect(value).toEqual({
      message: 'Here is how to open Settings:',
      steps: [{
        stepNumber: 1,
        instruction: 'Click Start.',
        target: {
          zone: 'start_menu',
          app: null,
          action: 'click',
          hint: 'the Windows logo',
        },
      }],
    })
  })

  it('parses an XML clarification and decodes entities', () => {
    expect(parseValue('<response><clarify>Is it Chrome &amp; Edge?</clarify></response>')).toEqual({
      message: 'Is it Chrome & Edge?',
      clarify: 'Is it Chrome & Edge?',
    })
  })

  it('parses a legacy single target and discards an invalid one', () => {
    const valid = parseValue(`
      <response>
        <message>Look at the bottom.</message>
        <target>{"zone":"taskbar","app":"Edge","action":"look","hint":"blue e"}</target>
      </response>
    `)
    expect(valid.target).toMatchObject({ zone: 'taskbar', app: 'Edge', action: 'look' })

    const invalid = parseValue(`
      <response>
        <message>The instructions are still useful.</message>
        <target>{"zone":"made_up","app":"Edge","action":"click","hint":"wrong"}</target>
      </response>
    `)
    expect(invalid).toEqual({ message: 'The instructions are still useful.' })
  })

  it('keeps a valid message when embedded step JSON is malformed', () => {
    expect(parseValue(
      '<response><message>Use the Start menu.</message><steps>[not JSON]</steps></response>',
    )).toEqual({ message: 'Use the Start menu.' })
  })

  it('accepts and cleans a legacy conversational plain-text response', () => {
    expect(parseValue('  Hello <b>there</b>!\u0000  ')).toEqual({ message: 'Hello there!' })
  })

  it('rejects malformed XML instead of exposing response markup', () => {
    const result = parseAssistantResponse('<response><message>unfinished')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('malformed XML')
  })
})

describe('serializeAssistantResponseForHistory', () => {
  it('serializes a complete walkthrough including canonical steps and targets', () => {
    const parsed = parseValue(JSON.stringify({
      kind: 'walkthrough',
      message: 'Open Bluetooth:',
      steps: [{
        stepNumber: 99,
        instruction: 'Select Bluetooth & devices.',
        target: {
          zone: 'ui_element',
          app: 'Settings',
          action: 'click',
          hint: 'the Bluetooth row',
          name: 'Bluetooth & devices',
          role: 'ListItem',
          window: 'Settings',
          visibility: 'after_navigation',
        },
      }],
    }))

    const serialized = serializeAssistantResponseForHistory(parsed)
    expect(JSON.parse(serialized)).toEqual({
      kind: 'walkthrough',
      message: 'Open Bluetooth:',
      steps: parsed.steps,
    })

    // Canonical history is itself a valid response, making it safe to reuse.
    expect(parseValue(serialized)).toEqual(parsed)
  })

  it('serializes clarification, message, and legacy single-target values', () => {
    expect(serializeAssistantResponseForHistory({
      message: 'Which browser?',
      clarify: 'Which browser?',
    })).toBe('{"kind":"clarification","message":"Which browser?"}')

    expect(serializeAssistantResponseForHistory({ message: 'You are welcome!' })).toBe(
      '{"kind":"message","message":"You are welcome!"}',
    )

    const targetHistory = serializeAssistantResponseForHistory({
      message: 'Click Start.',
      target: { zone: 'start_menu', app: null, action: 'click', hint: 'Windows logo' },
    })
    expect(JSON.parse(targetHistory)).toMatchObject({
      kind: 'message',
      target: { zone: 'start_menu', action: 'click' },
    })
  })

  it('does not serialize invalid injected targets and returns empty for no safe message', () => {
    const invalidTarget = {
      zone: 'arbitrary_coordinates',
      app: null,
      action: 'click',
      hint: 'unsafe',
    }
    const serialized = serializeAssistantResponseForHistory({
      message: 'Safe text',
      target: invalidTarget as never,
    })
    expect(JSON.parse(serialized)).toEqual({ kind: 'message', message: 'Safe text' })
    expect(serializeAssistantResponseForHistory({ message: '\u0000' })).toBe('')
  })
})
