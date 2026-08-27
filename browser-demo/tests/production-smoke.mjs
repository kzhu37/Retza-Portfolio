import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.RETZA_DEMO_URL || 'https://retza-live-demo.vercel.app'
const origin = new URL(base).origin
const timeout = 20_000
const trustedOidcToken = process.env.VERCEL_TRUSTED_OIDC_TOKEN || ''
const trustedHeaders = trustedOidcToken
  ? { 'x-vercel-trusted-oidc-idp-token': trustedOidcToken }
  : {}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const isFocused = locator => locator.evaluate(element => element === element.ownerDocument.activeElement)
const withTrustedHeaders = headers => ({ ...trustedHeaders, ...headers })

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
  const response = await request.get(base, { headers: trustedHeaders })
  assert.equal(response.status(), 200, `Expected production page 200, received ${response.status()}`)
  assert.match(response.headers()['content-security-policy'] || '', /default-src 'self'/)
  assert.equal(response.headers()['x-content-type-options'], 'nosniff')
  const referrerPolicy = response.headers()['referrer-policy'] || ''
  assert.ok(
    ['same-origin', 'origin-when-cross-origin', 'strict-origin-when-cross-origin', 'no-referrer'].includes(referrerPolicy),
    `Unexpected Referrer-Policy: ${referrerPolicy || '(missing)'}`,
  )
  const html = await response.text()
  assert.match(html, /Browser demo/)
  assert.match(html, /What changes in this demo\?/)

  const getApi = await request.get(`${base}/api/chat`, { headers: trustedHeaders })
  assert.equal(getApi.status(), 405, 'GET /api/chat must be rejected')

  const crossOrigin = await request.post(`${base}/api/chat`, {
    headers: withTrustedHeaders({ 'content-type': 'application/json', origin: 'https://example.com' }),
    data: { question: 'hello' },
  })
  assert.equal(crossOrigin.status(), 403, 'Cross-origin POST must be rejected')

  const invalid = await request.post(`${base}/api/chat`, {
    headers: withTrustedHeaders({ 'content-type': 'application/json', origin }),
    data: {},
  })
  assert.equal(invalid.status(), 400, 'Malformed bounded request must be rejected')

  const oversized = await request.post(`${base}/api/chat`, {
    headers: withTrustedHeaders({ 'content-type': 'application/json', origin }),
    data: { question: 'x'.repeat(13_000) },
  })
  assert.equal(oversized.status(), 413, 'Oversized request must be rejected')
}

const browser = await chromium.launch({ headless: true })
const browserErrors = []
const failedRequests = []
let context

try {
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: trustedHeaders,
  })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`))

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  try {
    const scopeLabel = page.locator('.scope-banner strong')
    await scopeLabel.waitFor({ state: 'visible', timeout: 15_000 })
    assert.equal((await scopeLabel.textContent())?.trim(), 'Browser demo')
  } catch {
    const title = await page.title().catch(() => '')
    const body = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 1200)
    throw new Error(`Production browser did not reach Retza. Title: ${title || '(none)'}. Body: ${body || '(empty)'}`)
  }

  await assertSecuritySurface(context.request)

  assert.equal(await page.getByRole('heading', { name: 'Retza' }).isVisible(), true)
  assert.equal(await page.getByRole('heading', { name: 'Interactive settings environment' }).isVisible(), true)

  await page.getByRole('button', { name: 'What changes in this demo?' }).click()
  assert.equal(await page.getByRole('heading', { name: 'Browser demo' }).isVisible(), true)
  assert.equal(await page.getByRole('heading', { name: 'Full Windows application' }).isVisible(), true)
  assert.match((await page.locator('#scope-info').textContent()) || '', /Windows UI Automation/)

  await startBluetooth(page)
  await clickShowMe(page)
  await assertVerified(page)
  assert.equal(await isFocused(page.locator('[data-retza-id="nav-bluetooth"]')), true)

  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByText('Step 2 of 2', { exact: true }).waitFor({ timeout })
  await clickShowMe(page)
  await assertVerified(page)
  assert.equal(await isFocused(page.locator('[data-retza-id="bluetooth-toggle"]')), true)
  await page.locator('[data-retza-id="bluetooth-toggle"]').click()
  assert.equal(await page.locator('[data-retza-id="bluetooth-toggle"]').getAttribute('aria-pressed'), 'true')

  await clickShowMe(page)
  await assertVerified(page)
  await page.evaluate(() => document.querySelector('[data-retza-id="bluetooth-toggle"]')?.remove())
  const lostStatus = await waitForStatus(page, /couldn't verify|not visible/i)
  assert.match(lostStatus, /couldn't verify|not visible/i)
  assert.equal(await page.locator('#highlight-ring').isVisible(), false)

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

  await page.getByText('Accessibility settings', { exact: true }).click()
  await page.getByRole('button', { name: 'Demonstrate proactive help' }).click()
  assert.equal(await page.getByText(/accelerated demo of proactive help/i).isVisible(), true)

  await page.getByRole('radio', { name: 'Large', exact: true }).check()
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('text-large')), true)
  await page.getByRole('radio', { name: 'Extra large', exact: true }).check()
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('text-xlarge')), true)

  const voice = page.locator('#voice-button')
  const speechState = { disabled: await voice.isDisabled(), label: await voice.getAttribute('aria-label') }
  if (speechState.disabled) assert.equal(speechState.label, 'Voice input unavailable')
  else assert.equal(speechState.label, 'Use voice input')

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

  const appSource = await page.evaluate(async () => fetch('/app.js').then(response => response.text()))
  assert.doesNotMatch(appSource, /AIza[0-9A-Za-z_-]{20,}/)
  assert.doesNotMatch(appSource, /GEMINI_API_KEY|VERCEL_OIDC_TOKEN|AI_GATEWAY_API_KEY/)

  const requestedOrigins = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).origin))
  assert.deepEqual([...new Set(requestedOrigins.filter(Boolean))], [origin])

  await page.reload({ waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  assert.equal(await isFocused(page.locator('.skip-link')), true)
  const outlineStyle = await page.locator('.skip-link').evaluate(node => getComputedStyle(node).outlineStyle)
  assert.notEqual(outlineStyle, 'none')

  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator('.assistant-pane').isVisible(), true)
  assert.equal(await page.locator('.computer-pane').isVisible(), true)
  const assistantBox = await page.locator('.assistant-pane').boundingBox()
  assert.ok(assistantBox && assistantBox.width <= 390)

  const reducedContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: trustedHeaders,
  })
  const reducedPage = await reducedContext.newPage()
  await reducedPage.goto(base, { waitUntil: 'networkidle', timeout: 30_000 })
  assert.equal(await reducedPage.locator('.watching-dot').evaluate(node => getComputedStyle(node).boxShadow), 'none')
  await reducedContext.close()

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
