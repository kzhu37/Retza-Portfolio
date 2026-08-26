import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
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

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', error => consoleErrors.push(error.message))

  // Regression: a validated AI walkthrough must render its steps instead of
  // discarding them after the introductory message.
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

  // Regression: scrolling a nested sandbox pane must reposition a live Show Me
  // ring. Scroll events do not bubble, so this specifically exercises capture.
  const sidebar = page.locator('#settings-sidebar')
  await page.evaluate(() => {
    const target = document.querySelector('[data-retza-id="nav-bluetooth"]')
    const spacer = document.createElement('div')
    spacer.id = 'scroll-regression-spacer'
    spacer.style.height = '420px'
    target?.parentElement?.insertBefore(spacer, target)
  })
  await page.waitForTimeout(50)
  const before = await page.locator('#highlight-ring').boundingBox()
  const targetBefore = await page.locator('[data-retza-id="nav-bluetooth"]').boundingBox()
  assert.ok(before && targetBefore)
  await sidebar.evaluate(node => { node.scrollTop = 300 })
  await page.waitForTimeout(80)
  const after = await page.locator('#highlight-ring').boundingBox()
  const targetAfter = await page.locator('[data-retza-id="nav-bluetooth"]').boundingBox()
  assert.ok(after && targetAfter)
  assert.ok(Math.abs((after.y - targetAfter.y) - (before.y - targetBefore.y)) < 3, 'Show Me ring must track nested pane scrolling')

  // Regression: a stale request must not clear or overwrite a newer request's
  // controller/state when two free-form submissions overlap.
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

  assert.deepEqual(consoleErrors, [], `Browser console/page errors: ${consoleErrors.join(' | ')}`)
  await context.close()
} finally {
  await browser.close().catch(() => {})
  await new Promise(resolve => server.close(resolve))
}

console.log('Retza local browser regression tests passed')
