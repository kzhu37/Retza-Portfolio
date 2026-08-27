const base = process.env.RETZA_DEMO_URL || 'https://retza-live-demo.vercel.app'
const expectedCommit = process.env.RETZA_EXPECTED_COMMIT || process.env.GITHUB_SHA || ''
const trustedOidcToken = process.env.VERCEL_TRUSTED_OIDC_TOKEN || ''
const headers = trustedOidcToken
  ? { 'x-vercel-trusted-oidc-idp-token': trustedOidcToken }
  : {}

function warn(message) {
  const safe = String(message).replace(/\r?\n/g, ' ')
  console.log(`::warning title=Production deployment freshness::${safe}`)
}

if (!expectedCommit) {
  warn('No expected commit was provided, so deployment freshness could not be compared.')
  process.exit(0)
}

try {
  const response = await fetch(`${base}/api/health`, {
    headers,
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    warn(`The public Retza deployment does not expose commit metadata (${response.status}). The live-demo smoke test will still verify the deployed product, but Vercel is not currently proving that it tracks GitHub main.`)
    process.exit(0)
  }

  const payload = await response.json().catch(() => ({}))
  if (payload.commit === expectedCommit) {
    console.log(`Retza production is serving the current GitHub commit ${expectedCommit}`)
  } else {
    warn(`The public Retza deployment reports commit ${payload.commit || '(unknown)'} instead of current GitHub commit ${expectedCommit}. The external Vercel project needs its Git connection restored for automatic freshness.`)
  }
} catch (error) {
  warn(`Deployment freshness could not be checked: ${error instanceof Error ? error.message : String(error)}`)
}
