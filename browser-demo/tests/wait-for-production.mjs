const base = process.env.RETZA_DEMO_URL || 'https://retza-live-demo.vercel.app'
const expectedCommit = process.env.RETZA_EXPECTED_COMMIT || process.env.GITHUB_SHA || ''
const trustedOidcToken = process.env.VERCEL_TRUSTED_OIDC_TOKEN || ''
const headers = trustedOidcToken
  ? { 'x-vercel-trusted-oidc-idp-token': trustedOidcToken }
  : {}

if (!expectedCommit) {
  throw new Error('RETZA_EXPECTED_COMMIT or GITHUB_SHA is required')
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const deadline = Date.now() + 240_000
let lastObservation = 'no response'

while (Date.now() < deadline) {
  try {
    const response = await fetch(`${base}/api/health`, {
      headers,
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    const text = await response.text()
    lastObservation = `${response.status} ${text.slice(0, 300)}`

    if (response.ok) {
      const payload = JSON.parse(text)
      if (payload.commit === expectedCommit) {
        console.log(`Retza production is serving commit ${expectedCommit}`)
        process.exit(0)
      }
    }
  } catch (error) {
    lastObservation = error instanceof Error ? error.message : String(error)
  }

  await sleep(5_000)
}

throw new Error(`Timed out waiting for production commit ${expectedCommit}. Last observation: ${lastObservation}`)
