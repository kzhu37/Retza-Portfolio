import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.RETZA_DEMO_URL || 'https://retza-portfolio-demo-xiangseanzhu-7370.vercel.app'
const origin = new URL(base).origin
const timeout = 20_000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForStatus(page, pattern) {
  await page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(document.querySelector('#show-me-status')?.textContent || ''),
    { source: pattern.source, flags: pattern.flags },
    { timeout },
  )
  return (await page.locator('#show-me-status').textContent()) || ''
}

async function startBluetooth(page) {
  await page.getByRole('button', { name: 'Turn on Bluetooth' }).click()
  await page.getByText('Step 1 of 2', { exact: true }).waitFor({ timeout })
}

async function clickShowMe(page) {
  await page.getByRole('button', { name: /Show Me/ }).click()
}

async function assertVerified(page) {
  const status = await waitForStatus(page, /Verified from sandbox semantics/i)
  assert.match(status, /Verified from sandbox semantics/i)
  assert.equal(await page.locator('#highlight-ring').isVisible(), true)
  assert.equal(await page.locator('#highlight-ring').getAttribute('data-active'), 'true')
}

async function assertSecuritySurface(request) {
  const response = await request.get(base)
  assert.equal(response.status(), 200, `Expected production page 200, received ${response.status()}`)
  assert.match(response.headers()['content-security-policy'] || '', /default-src 'self'/)
  assert.equal(response.headers()['x-content-type-options'], 'nosniff')
  const referrerPolicy = response.headers()['referrer-policy'] || ''
  assert.ok(
    ['same-origin', 'origin-when-cross-origin', 'strict-origin-when-cross-origin', 'no-referrer'].includes(referrerPolicy),
    `Unexpected Referrer-Policy: ${referrerPolicy || '(missing)'}`,
  )
  const html = await response.text()
  assert.match(html, /Portfolio browser demo/)
  assert.match(html, /What changes in this demo\?/)

  const getApi = await request.get(`${base}/api/chat`)
  assert.equal(getApi.status(), 405, 'GET /api/chat must be rejected')

  const crossOrigin = await request.post(`${base}/api/chat`, {
    headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    data: { question: 'hello' },
  })
  assert.equal(crossOrigin.status(), 403, 'Cross-origin POST must be rejected')

  const invalid = await request.post(`${base}/api/chat`, {
    headers: { 'content-type': 'application/json', origin },
    data: {},
  })
  assert.equal(invalid.status(), 400, 'Malformed bounded request must be rejected')

  const oversized = await request.post(`${base}/api/chat`, {
    headers: { 'content-type': 'application/json', origin },
    data: { question: 'x'.repeat(13_000) },
  })
  assert.equal(oversized.status(), 413, 'Oversized request must be rejected')
}

const browser = await chromium.launch({ headless: true })
const browserErrors = []
const failedRequests = []
let context

try {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`))

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  try {
    await page.getByText('Portfolio browser demo', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 })
  } catch {
    const title = await page.title().catch(() => '')
    const body = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 1200)
    throw new Error(`Production browser did not reach Retza. Title: ${title || '(none)'}. Body: ${body || '(empty)'}`)
  }

  // Once the browser has completed any platform challenge, use its shared-cookie
  // request context to verify the actual application HTTP/API surface.
  await assertSecuritySurface(context.request)

  assert.equal(await page.getByRole('heading', { name: 'Retza' }).isVisible(), true)
  assert.equal(await page.getByRole('heading', { name: 'Interactive settings environment' }).isVisible(), true)

  // Disclosure is visible and distinguishes the browser adapter from the Windows application.
  await page.getByRole('button', { name: 'What changes in this demo?' }).click()
  assert.equal(await page.getByRole('heading', { name: 'Browser demo' }).isVisible(), true)
  assert.equal(await page.getByRole('heading', { name: 'Full Windows application' }).isVisible(), true)
  assert.match((await page.locator('#scope-info').textContent()) || '', /Windows UI Automation/)

  // First-visit acceptance path: deterministic Bluetooth walkthrough + verified Show Me.
  await startBluetooth(page)
  await clickShowMe(page)
  await assertVerified(page)
  assert.equal(await page.locator('[data-retza-id="nav-bluetooth"]').isFocused(), true)

  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByText('Step 2 of 2', { exact: true }).waitFor({ timeout })
  await clickShowMe(page)
  await assertVerified(page)
  assert.equal(await page.locator('[data-retza-id="bluetooth-toggle"]').isFocused(), true)
  await page.locator('[data-retza-id="bluetooth-toggle"]').click()
  assert.equal(await page.locator('[data-retza-id="bluetooth-toggle"]').getAttribute('aria-pressed'), 'true')

  // Revalidation: a highlighted target disappears and the guide fails closed.
  await clickShowMe(page)
  await assertVerified(page)
  await page.evaluate(() => document.querySelector('[data-retza-id="bluetooth-toggle"]')?.remove())
  const lostStatus = await waitForStatus(page, /couldn't verify|not visible/i)
  assert.match(lostStatus, /couldn't verify|not visible/i)
  assert.equal(await page.locator('#highlight-ring').isVisible(), false)

  // Ambiguity: duplicate matching semantic evidence must be rejected instead of guessed.
  await page.reload({ waitUntil: 'networkidle' })
  await startBluetooth(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.evaluate(() => {
    const target = document.querySelector('[data-retza-id="bluetooth-toggle"]')
    if (target) target.parentElement?.appendChild(target.cloneNode(true))
  })
  await clickShowMe(page)
  assert.match(await waitForStatus(page, /more than one matching control/i), /more than one matching control/i)
  assert.equal(await page.locator('#highlight-ring').isVisible(), false)

  // Hidden and disabled controls are rejected for click guidance.
  await page.reload({ waitUntil: 'networkidle' })
  await startBluetooth(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.evaluate(() => { const target = document.querySelector('[data-retza-id="bluetooth-toggle"]'); if (target) target.hidden = true })
  await clickShowMe(page)
  assert.match(await waitForStatus(page, /not visible right now/i), /not visible right now/i)

  await page.reload({ waitUntil: 'networkidle' })
  await startBluetooth(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.evaluate(() => { const target = document.querySelector('[data-retza-id="bluetooth-toggle"]'); if (target) target.disabled = true })
  await clickShowMe(page)
  assert.match(await waitForStatus(page, /not currently available/i), /not currently available/i)

  // Multiple deterministic scenarios navigate and progress without AI.
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Connect to Wi-Fi' }).click()
  await page.getByText('Step 1 of 3', { exact: true }).waitFor({ timeout })
  await page.getByRole('button', { name: 'Next' }).click()
  await clickShowMe(page)
  await assertVerified(page)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Change my display settings' }).click()
  await page.getByText('Step 1 of 3', { exact: true }).waitFor({ timeout })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await clickShowMe(page)
  await assertVerified(page)
  assert.equal(await page.locator('[data-retza-id="brightness-slider"]').getAttribute('type'), 'range')

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Check for Windows updates' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await clickShowMe(page)
  await assertVerified(page)

  // Proactive help is explicitly sandbox-only and can be demonstrated without altering desktop thresholds.
  await page.getByText('Accessibility settings', { exact: true }).click()
  await page.getByRole('button', { name: 'Demonstrate proactive help' }).click()
  assert.equal(await page.getByText(/accelerated portfolio demonstration of proactive help/i).isVisible(), true)

  // Text-size accessibility controls work.
  await page.getByLabel('Large').check()
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('text-large')), true)
  await page.getByLabel('Extra large').check()
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('text-xlarge')), true)

  // Speech is either available or presents the documented graceful fallback.
  const voice = page.locator('#voice-button')
  const speechState = { disabled: await voice.isDisabled(), label: await voice.getAttribute('aria-label') }
  if (speechState.disabled) assert.equal(speechState.label, 'Voice input unavailable')
  else assert.equal(speechState.label, 'Use voice input')

  // A real free-form question must use the protected production AI boundary successfully.
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('#assistant-input').fill('What is the difference between a browser tab and a browser window?')
  const [aiResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/chat') && response.request().method() === 'POST', { timeout: 20_000 }),
    page.getByRole('button', { name: 'Send' }).click(),
  ])
  assert.equal(aiResponse.status(), 200, `Expected live AI request 200, received ${aiResponse.status()}`)
  const aiPayload = await aiResponse.json()
  assert.ok(['message', 'clarification', 'walkthrough'].includes(aiPayload.kind))
  assert.ok(typeof aiPayload.message === 'string' && aiPayload.message.length > 0)
  await page.getByText(aiPayload.message, { exact: true }).waitFor({ timeout })

  // Client assets must not expose server credential names or recognizable Google API keys.
  const appSource = await page.evaluate(async () => fetch('/app.js').then(response => response.text()))
  assert.doesNotMatch(appSource, /AIza[0-9A-Za-z_-]{20,}/)
  assert.doesNotMatch(appSource, /GEMINI_API_KEY|VERCEL_OIDC_TOKEN|AI_GATEWAY_API_KEY/)

  // The browser itself should make requests only to the deployed Retza origin.
  const requestedOrigins = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).origin))
  assert.deepEqual([...new Set(requestedOrigins.filter(Boolean))], [origin])

  // Keyboard focus is visible from the first Tab stop.
  await page.reload({ waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  assert.equal(await page.locator('.skip-link').isFocused(), true)
  const outlineStyle = await page.locator('.skip-link').evaluate(node => getComputedStyle(node).outlineStyle)
  assert.notEqual(outlineStyle, 'none')

  // Responsive layout remains usable on a phone-sized viewport.
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator('.assistant-pane').isVisible(), true)
  assert.equal(await page.locator('.computer-pane').isVisible(), true)
  const assistantBox = await page.locator('.assistant-pane').boundingBox()
  assert.ok(assistantBox && assistantBox.width <= 390)

  // Reduced-motion preference is honored.
  const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const reducedPage = await reducedContext.newPage()
  await reducedPage.goto(base, { waitUntil: 'networkidle', timeout: 30_000 })
  assert.equal(await reducedPage.locator('.watching-dot').evaluate(node => getComputedStyle(node).boxShadow), 'none')
  await reducedContext.close()

  // Fresh refresh still returns to a complete, usable first-visit state.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.getByRole('button', { name: 'Turn on Bluetooth' }).isVisible(), true)
  assert.equal(await page.locator('#assistant-input').isVisible(), true)

  await sleep(250)
  assert.deepEqual(browserErrors, [], `Browser console/page errors: ${browserErrors.join(' | ')}`)
  assert.deepEqual(failedRequests, [], `Failed requests: ${failedRequests.join(' | ')}`)
} finally {
  await context?.close().catch(() => {})
  await browser.close()
}

console.log('Retza production browser smoke test passed')
