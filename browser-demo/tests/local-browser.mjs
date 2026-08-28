import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, normalize } from 'node:path'
import { chromium } from 'playwright'

const root = new URL('../dist/', import.meta.url)
const host = '127.0.0.1'
const port = 4173
const base = `http://${host}:${port}`

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', base).pathname
    if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'API is mocked by Playwright in this local test.' }))
      return
    }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '')
    const file = new URL(safe, root)
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': contentTypes[extname(safe)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(port, host, resolve)
})

const browser = await chromium.launch({ headless: true })

function durationSeconds(value) {
  const first = String(value).split(',')[0].trim()
  if (first.endsWith('ms')) return Number.parseFloat(first) / 1000
  if (first.endsWith('s')) return Number.parseFloat(first)
  return Number.POSITIVE_INFINITY
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', error => consoleErrors.push(error.message))

  // A validated provider walkthrough must render its steps and allow a
  // semantic Show Me target to be positioned from live sandbox bounds.
  await page.route('**/api/chat', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'walkthrough',
        message: 'I can guide that inside the sandbox.',
        steps: [{
          instruction: 'Open Bluetooth & devices from the Settings sidebar.',
          target: {
            zone: 'ui_element',
            app: 'Demo Computer',
            action: 'click',
            name: 'Bluetooth & devices',
            role: 'button',
            window: 'Settings',
            visibility: 'visible_now',
            semanticId: 'nav-bluetooth',
            hint: 'the Bluetooth & devices item in the Settings sidebar',
          },
        }],
      }),
    })
  })

  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('#assistant-input').fill('Give me an AI-generated sandbox walkthrough.')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByText('Step 1 of 1', { exact: true }).waitFor()
  assert.equal(await page.getByText('Open Bluetooth & devices from the Settings sidebar.', { exact: true }).isVisible(), true)
  await page.getByRole('button', { name: /Show Me/ }).click()
  await page.getByText(/Verified from sandbox semantics/i).waitFor()
  assert.equal(await page.locator('#highlight-ring').isVisible(), true)

  // Nested scrolling must reposition a live Show Me ring. Scroll events do not
  // bubble, so this specifically exercises the capture path.
  const sidebar = page.locator('#settings-sidebar')
  await page.evaluate(() => {
    const target = document.querySelector('[data-retza-id="nav-bluetooth"]')
    const spacer = document.createElement('div')
    spacer.id = 'scroll-regression-spacer'
    spacer.style.height = '420px'
    target?.parentElement?.insertBefore(spacer, target)
  })
  const ringGeometry = () => page.evaluate(() => {
    const ring = document.querySelector('#highlight-ring')
    const target = document.querySelector('[data-retza-id="nav-bluetooth"]')
    const sandbox = document.querySelector('#sandbox')
    if (!ring || !target || !sandbox) return null
    const targetRect = target.getBoundingClientRect()
    const sandboxRect = sandbox.getBoundingClientRect()
    return {
      positionedTop: Number.parseFloat(ring.style.top),
      expectedTop: targetRect.top - sandboxRect.top + sandbox.scrollTop - 6,
    }
  })
  await page.waitForTimeout(100)
  const before = await ringGeometry()
  assert.ok(before)
  assert.ok(Math.abs(before.positionedTop - before.expectedTop) < 1, 'Show Me ring must start aligned with the semantic target')
  await sidebar.evaluate(node => { node.scrollTop = 300 })
  await page.waitForTimeout(100)
  const after = await ringGeometry()
  assert.ok(after)
  assert.ok(Math.abs(after.positionedTop - after.expectedTop) < 1, 'Show Me ring must track nested pane scrolling')
  assert.notEqual(after.positionedTop, before.positionedTop, 'Nested scrolling must recompute the Show Me ring position')

  // A stale request must not overwrite a newer request when submissions overlap.
  await page.unroute('**/api/chat')
  let requestCount = 0
  await page.route('**/api/chat', async route => {
    requestCount += 1
    const current = requestCount
    if (current === 1) await new Promise(resolve => setTimeout(resolve, 500))
    else await new Promise(resolve => setTimeout(resolve, 40))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'message', message: current === 1 ? 'stale first response' : 'newest response wins' }),
    }).catch(() => {})
  })

  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('#assistant-input').fill('First free-form request.')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(50)
  await page.locator('#assistant-input').fill('Second free-form request.')
  await page.keyboard.press('Enter')
  await page.getByText('newest response wins', { exact: true }).waitFor()
  await page.waitForTimeout(650)
  assert.equal(await page.getByText('stale first response', { exact: true }).count(), 0)
  assert.equal(await page.getByText(/AI request timed out/i).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Send' }).isDisabled(), false)
  assert.equal(requestCount, 2)

  // Accessibility text-size controls must change the actual document scale.
  await page.getByText('Accessibility settings', { exact: true }).click()
  await page.getByLabel('Extra large').check()
  const textScale = await page.evaluate(() => ({
    className: document.body.className,
    fontSize: Number.parseFloat(getComputedStyle(document.body).fontSize),
  }))
  assert.match(textScale.className, /text-xlarge/)
  assert.ok(textScale.fontSize >= 20)

  // Responsive rules must stack the major panes and header at a narrow width.
  await page.setViewportSize({ width: 640, height: 900 })
  const responsiveState = await page.evaluate(() => {
    const header = document.querySelector('.site-header')
    const assistant = document.querySelector('.assistant-pane')?.getBoundingClientRect()
    const computer = document.querySelector('.computer-pane')?.getBoundingClientRect()
    return {
      headerDirection: header ? getComputedStyle(header).flexDirection : '',
      assistantTop: assistant?.top ?? 0,
      computerTop: computer?.top ?? 0,
    }
  })
  assert.equal(responsiveState.headerDirection, 'column')
  assert.ok(responsiveState.computerTop > responsiveState.assistantTop)

  // Reduced-motion preference must suppress normal transition timing.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await page.evaluate(() => ({
    matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ringTransition: getComputedStyle(document.querySelector('#highlight-ring')).transitionDuration,
  }))
  assert.equal(reducedMotion.matches, true)
  assert.ok(durationSeconds(reducedMotion.ringTransition) <= 0.001)

  // Provider failure must remain a bounded user-facing state, while deterministic
  // walkthroughs stay available.
  await page.unroute('**/api/chat')
  await page.route('**/api/chat', async route => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'ai_unavailable' }),
    })
  })
  await page.locator('#assistant-input').fill('Explain a broad computer topic.')
  await page.keyboard.press('Enter')
  await page.getByText('Broader AI questions are temporarily unavailable. Try one of the supported walkthroughs above.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Send' }).isDisabled(), false)
  assert.ok(await page.locator('.example-button').count() > 0)

  assert.deepEqual(consoleErrors, [], `Browser console/page errors: ${consoleErrors.join(' | ')}`)
  await context.close()
} finally {
  await browser.close().catch(() => {})
  await new Promise(resolve => server.close(resolve))
}

console.log('Retza local browser regression tests passed')
