import { EXAMPLE_IDS, SCENARIOS, matchScenario, numberedSteps } from './lib/scenarios.js'
import { createHighlightController } from './lib/target-resolver.js'

const $ = selector => document.querySelector(selector)
const elements = {
  examples: $('#examples'), chat: $('#chat-log'), form: $('#assistant-form'), input: $('#assistant-input'), send: $('#send-button'), voice: $('#voice-button'),
  scopeButton: $('#scope-info-button'), scopePanel: $('#scope-info'), walkthrough: $('#walkthrough'), progress: $('#walkthrough-progress'), instruction: $('#walkthrough-instruction'),
  back: $('#walkthrough-back'), next: $('#walkthrough-next'), showMe: $('#show-me'), cancel: $('#walkthrough-cancel'), showStatus: $('#show-me-status'),
  sandbox: $('#sandbox'), sidebar: $('#settings-sidebar'), content: $('#demo-content'), windowTitle: $('#demo-window-title'), context: $('#demo-context'), ring: $('#highlight-ring'),
  toast: $('#toast'), watchingToggle: $('#watching-toggle'), watchingDot: $('#watching-dot'), proactiveDemo: $('#proactive-demo'),
}

const state = {
  page: 'home',
  scenario: null,
  steps: [],
  stepIndex: 0,
  bluetooth: false,
  wifi: true,
  selectedNetwork: null,
  watching: true,
  history: [],
  recognition: null,
  typingNode: null,
  aiController: null,
}

const highlight = createHighlightController(elements.sandbox, elements.ring, failure => {
  elements.showStatus.textContent = failure.message
})

function escapeText(value) { return String(value ?? '') }
function addMessage(role, text, options = {}) {
  const article = document.createElement('article')
  article.className = `message ${role === 'user' ? 'user-message' : 'fox-message'}${options.error ? ' error' : ''}${options.proactive ? ' proactive' : ''}`
  if (role !== 'user') {
    const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = '🦊'; article.appendChild(avatar)
  }
  const bubble = document.createElement('div'); bubble.className = 'bubble'
  const paragraph = document.createElement('p'); paragraph.textContent = escapeText(text); bubble.appendChild(paragraph); article.appendChild(bubble)
  elements.chat.appendChild(article); elements.chat.scrollTop = elements.chat.scrollHeight
  if (!options.transient) state.history.push({ role: role === 'user' ? 'user' : 'model', text: String(text).slice(0, 1500) })
  if (state.history.length > 8) state.history.splice(0, state.history.length - 8)
  return article
}

function showTyping() {
  if (state.typingNode) return
  const article = document.createElement('article'); article.className = 'message fox-message'
  article.innerHTML = '<div class="avatar" aria-hidden="true">🦊</div><div class="bubble"><span class="typing" role="status" aria-label="Retza is thinking"><span></span><span></span><span></span></span></div>'
  elements.chat.appendChild(article); elements.chat.scrollTop = elements.chat.scrollHeight; state.typingNode = article
}
function hideTyping() { state.typingNode?.remove(); state.typingNode = null }
function toast(text) { elements.toast.textContent = text; elements.toast.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { elements.toast.hidden = true }, 3600) }

const sidebarItems = [
  ['System', 'nav-system', '◫', 'system'], ['Bluetooth & devices', 'nav-bluetooth', '◉', 'bluetooth'], ['Network & internet', 'nav-wifi', '⌁', 'wifi'],
  ['Apps', 'nav-apps', '▦', 'apps'], ['Windows Update', 'nav-update', '↻', 'update'],
]

function controlAttrs(id, windowName = 'Settings') { return `data-retza-control data-retza-id="${id}" data-retza-app="Demo Computer" data-retza-window="${windowName}"` }
function renderSidebar() {
  elements.sidebar.innerHTML = sidebarItems.map(([name,id,icon,page]) => `<button ${controlAttrs(id)} aria-label="${name}" class="sidebar-button ${state.page===page?'active':''}" type="button" data-page="${page}"><span class="sidebar-icon" aria-hidden="true">${icon}</span><span>${name}</span></button>`).join('')
  elements.sidebar.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)))
}

function pageTemplate(page) {
  switch (page) {
    case 'system': return `<h3>System</h3><p class="demo-subtitle">Display, sound, notifications, and power.</p><div class="settings-list"><button ${controlAttrs('system-display')} aria-label="Display" class="setting-row setting-row-button" type="button" data-open="display"><span><span class="setting-label">Display</span><span class="setting-description">Brightness, scale, layout</span></span><span>›</span></button><button ${controlAttrs('system-sound')} aria-label="Sound" class="setting-row setting-row-button" type="button" data-open="sound"><span><span class="setting-label">Sound</span><span class="setting-description">Volume, output, input</span></span><span>›</span></button></div>`
    case 'bluetooth': return `<h3>Bluetooth & devices</h3><p class="demo-subtitle">Manage simulated nearby devices.</p><div class="settings-list"><div class="setting-row"><div><div class="setting-label">Bluetooth</div><div class="setting-description">Turn discovery on or off in this sandbox.</div></div><button ${controlAttrs('bluetooth-toggle')} aria-label="Bluetooth" aria-pressed="${state.bluetooth}" class="switch" type="button"></button></div><div class="setting-card"><div class="setting-label">Devices</div><p class="setting-description">Keyboard · Connected<br>Headphones · Paired</p></div></div>`
    case 'wifi': return `<h3>Network & internet</h3><p class="demo-subtitle">Wi-Fi and simulated network settings.</p><div class="settings-list"><div class="setting-row"><div><div class="setting-label">Wi-Fi</div><div class="setting-description">Wireless connection in the demo computer.</div></div><button ${controlAttrs('wifi-toggle')} aria-label="Wi-Fi" aria-pressed="${state.wifi}" class="switch" type="button"></button></div><div class="setting-card"><div class="setting-label">Available networks</div><div style="display:grid;gap:8px;margin-top:12px"><button ${controlAttrs('wifi-retza-guest')} aria-label="Retza Guest" class="network-button" type="button">Retza Guest ${state.selectedNetwork==='Retza Guest'?'· Connected':''}</button><button ${controlAttrs('wifi-library')} aria-label="Library Wi-Fi" class="network-button" type="button">Library Wi-Fi</button></div></div></div>`
    case 'display': return `<h3>Display</h3><p class="demo-subtitle">Brightness, scale, and layout.</p><div class="settings-list"><div class="setting-card"><label class="setting-label" for="brightness">Brightness</label><p class="setting-description">Change the brightness of the simulated display.</p><input ${controlAttrs('brightness-slider')} id="brightness" aria-label="Brightness" class="demo-slider" type="range" min="0" max="100" value="72"></div><div class="setting-card"><label class="setting-label" for="scale">Scale</label><select ${controlAttrs('display-scale')} id="scale" aria-label="Scale" class="demo-select"><option>100%</option><option selected>125%</option><option>150%</option></select></div></div>`
    case 'sound': return `<h3>Sound</h3><p class="demo-subtitle">Choose where audio plays.</p><div class="settings-list"><div class="setting-card"><label class="setting-label" for="output-device">Output device</label><p class="setting-description">Select a simulated speaker or headset.</p><select ${controlAttrs('sound-output')} id="output-device" aria-label="Output device" class="demo-select"><option>Built-in speakers</option><option>Retza Headphones</option></select></div></div>`
    case 'apps': return `<h3>Apps</h3><p class="demo-subtitle">Installed apps and defaults.</p><div class="settings-list"><button ${controlAttrs('apps-installed')} aria-label="Installed apps" class="setting-row setting-row-button" type="button" data-open="installed-apps"><span><span class="setting-label">Installed apps</span><span class="setting-description">Find, manage, and remove apps</span></span><span>›</span></button></div>`
    case 'installed-apps': return `<h3>Installed apps</h3><p class="demo-subtitle">Manage apps in this simulated computer.</p><div class="settings-list"><div class="setting-card"><label class="setting-label" for="search-apps">Search apps</label><input ${controlAttrs('search-apps')} id="search-apps" aria-label="Search apps" class="demo-input" placeholder="Search apps" type="search"></div><div class="setting-row"><div><div class="setting-label">Photo Viewer</div><div class="setting-description">Demo application · 82 MB</div></div><button ${controlAttrs('remove-photo-viewer')} aria-label="Remove Photo Viewer" class="remove-button" type="button">Remove</button></div><div class="setting-row"><div><div class="setting-label">Notes</div><div class="setting-description">Demo application · 24 MB</div></div><button aria-label="Remove Notes" class="remove-button" type="button" disabled>Remove</button></div></div>`
    case 'update': return `<h3>Windows Update</h3><p class="demo-subtitle">Update status in the simulated environment.</p><div class="settings-list"><div class="setting-row"><div><div class="setting-label">You're up to date</div><div class="setting-description" id="update-status">Last checked just now</div></div><button ${controlAttrs('check-updates')} aria-label="Check for updates" class="check-button" type="button">Check for updates</button></div></div>`
    case 'search': return `<h3>Search</h3><p class="demo-subtitle">Find apps, settings, and files in the simulated computer.</p><div class="settings-list"><div class="setting-card"><label class="sr-only" for="demo-search">Search apps, settings, and files</label><input ${controlAttrs('search-box','Search')} id="demo-search" aria-label="Search apps, settings, and files" class="demo-input" placeholder="Search apps, settings, and files" type="search"></div><div class="setting-card"><div class="setting-label">Suggested</div><p class="setting-description">Try typing “Device Manager”.</p></div></div>`
    case 'search-device-manager': return `<h3>Search</h3><p class="demo-subtitle">Results for “Device Manager”.</p><div class="settings-list"><button ${controlAttrs('device-manager-result','Search')} aria-label="Device Manager" class="setting-row setting-row-button result-button" type="button" data-open="device-manager"><span><span class="setting-label">Device Manager</span><span class="setting-description">System tool · Demo result</span></span><span>Open</span></button></div>`
    case 'device-manager': return `<h3>Device Manager</h3><p class="demo-subtitle">Simulated device categories. This page does not inspect real hardware.</p><div class="settings-list"><div class="setting-row"><span class="setting-label">Audio inputs and outputs</span><span>⌄</span></div><div class="setting-row"><span class="setting-label">Bluetooth</span><span>⌄</span></div><div class="setting-row"><span class="setting-label">Display adapters</span><span>⌄</span></div></div>`
    default: return `<h3>Settings</h3><p class="demo-subtitle">Choose a section to begin.</p><div class="settings-list"><div class="setting-card"><div class="setting-label">Welcome to the Retza demo computer</div><p class="setting-description">These are real interactive DOM controls inside the page. Retza can verify and highlight them, but it cannot inspect your real computer.</p></div><div class="setting-card"><div class="setting-label">Try the assistant</div><p class="setting-description">“Turn on Bluetooth” is the fastest route to a complete Show Me experience.</p></div></div>`
  }
}

function wireContent() {
  elements.content.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.open)))
  elements.content.querySelector('[data-retza-id="bluetooth-toggle"]')?.addEventListener('click', event => { state.bluetooth = !state.bluetooth; event.currentTarget.setAttribute('aria-pressed', String(state.bluetooth)); toast(`Demo Bluetooth ${state.bluetooth ? 'on' : 'off'}`) })
  elements.content.querySelector('[data-retza-id="wifi-toggle"]')?.addEventListener('click', event => { state.wifi = !state.wifi; event.currentTarget.setAttribute('aria-pressed', String(state.wifi)); toast(`Demo Wi-Fi ${state.wifi ? 'on' : 'off'}`) })
  elements.content.querySelector('[data-retza-id="wifi-retza-guest"]')?.addEventListener('click', () => { state.selectedNetwork = 'Retza Guest'; renderDemo(); toast('Connected to Retza Guest inside the sandbox') })
  elements.content.querySelector('[data-retza-id="check-updates"]')?.addEventListener('click', event => { event.currentTarget.disabled = true; event.currentTarget.textContent = 'Checking…'; setTimeout(() => { if (!event.currentTarget.isConnected) return; event.currentTarget.disabled = false; event.currentTarget.textContent = 'Check for updates'; $('#update-status').textContent = 'Checked just now · No updates found'; }, 800) })
  elements.content.querySelector('[data-retza-id="remove-photo-viewer"]')?.addEventListener('click', () => toast('Demo only: Photo Viewer would be removed after confirmation.'))
  const search = elements.content.querySelector('[data-retza-id="search-box"]')
  search?.addEventListener('input', event => { if (/device manager/i.test(event.target.value)) setPage('search-device-manager') })
}

function renderDemo() {
  renderSidebar(); elements.content.innerHTML = pageTemplate(state.page); wireContent(); elements.context.textContent = `Demo Computer · ${labelForPage(state.page)}`; elements.windowTitle.textContent = state.page.startsWith('search') ? 'Search' : state.page === 'device-manager' ? 'Device Manager' : 'Settings'; highlight.reposition()
}
function labelForPage(page) { return ({home:'Home',system:'System',bluetooth:'Bluetooth & devices',wifi:'Network & internet',display:'Display',sound:'Sound',apps:'Apps','installed-apps':'Installed apps',update:'Windows Update',search:'Search','search-device-manager':'Search results','device-manager':'Device Manager'})[page] || page }
function setPage(page) { state.page = page || 'home'; renderDemo() }

elements.sandbox.querySelector('#taskbar-search').addEventListener('click', () => setPage('search'))

function renderExamples() {
  elements.examples.innerHTML = ''
  EXAMPLE_IDS.forEach(id => { const scenario = SCENARIOS[id]; const button = document.createElement('button'); button.type='button'; button.className='example-button'; button.textContent=scenario.label; button.addEventListener('click', () => submitQuestion(scenario.label)); elements.examples.appendChild(button) })
}

function beginWalkthrough(message, steps, scenario = null) {
  state.scenario = scenario
  state.steps = steps.map((step, index) => ({ ...step, stepNumber: index + 1 }))
  state.stepIndex = 0
  addMessage('fox', message)
  elements.walkthrough.hidden = false
  renderStep()
  elements.walkthrough.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function beginScenario(scenario) {
  beginWalkthrough(scenario.intro, numberedSteps(scenario), scenario)
}

function renderStep() {
  const step = state.steps[state.stepIndex]; if (!step) return
  highlight.clear(); elements.showStatus.textContent = ''
  if (step.page) setPage(step.page)
  else highlight.reposition()
  elements.progress.textContent = `Step ${state.stepIndex + 1} of ${state.steps.length}`; elements.instruction.textContent = step.instruction; elements.back.disabled = state.stepIndex === 0; elements.next.textContent = state.stepIndex === state.steps.length - 1 ? 'Finish' : 'Next'; elements.showMe.disabled = !step.target || step.target.zone === 'none'
}
function endWalkthrough(completed = false) { highlight.clear(); elements.walkthrough.hidden = true; if (completed) addMessage('fox','You finished the walkthrough. The browser demo used only controls inside the sandbox.'); state.scenario=null; state.steps=[]; state.stepIndex=0 }

elements.back.addEventListener('click', () => { if (state.stepIndex > 0) { state.stepIndex--; renderStep() } })
elements.next.addEventListener('click', () => { if (state.stepIndex >= state.steps.length - 1) return endWalkthrough(true); state.stepIndex++; renderStep() })
elements.cancel.addEventListener('click', () => endWalkthrough(false))
elements.showMe.addEventListener('click', () => {
  const step = state.steps[state.stepIndex]; if (!step?.target) return
  elements.showMe.setAttribute('aria-busy','true'); elements.showStatus.textContent = 'Verifying the target inside the demo computer…'
  requestAnimationFrame(() => {
    const result = highlight.show(step.target); elements.showMe.setAttribute('aria-busy','false')
    elements.showStatus.textContent = result.ok ? 'Verified from sandbox semantics and live DOM bounds.' : result.message
    if (result.ok) result.element?.focus({ preventScroll:false })
  })
})

function demoContext() { return { page: labelForPage(state.page), bluetooth: state.bluetooth, wifi: state.wifi, selectedNetwork: state.selectedNetwork, visibleWindow: elements.windowTitle.textContent } }

function cancelAIRequest() {
  const controller = state.aiController
  if (!controller) return
  state.aiController = null
  controller.abort()
  hideTyping()
  elements.send.disabled = false
}

async function askAI(question) {
  const previous = state.aiController
  const controller = new AbortController()
  state.aiController = controller
  previous?.abort()
  const timeout = setTimeout(() => controller.abort(), 10500)

  try {
    const response = await fetch('/api/chat', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ question, history: state.history.slice(-6), demoContext: demoContext() }), signal: controller.signal })
    const payload = await response.json().catch(() => ({}))
    if (state.aiController !== controller) return
    if (!response.ok) {
      if (response.status === 429) throw new Error('Retza’s AI is receiving too many requests right now. The supported demo walkthroughs still work.')
      if (payload.code === 'ai_unavailable') throw new Error('Broader AI questions are temporarily unavailable. Try one of the supported walkthroughs above.')
      if (payload.code === 'timeout') throw new Error('The AI request took too long. Please try again, or use a supported walkthrough.')
      throw new Error(payload.error || 'Retza could not complete that AI request. The deterministic demo scenarios are still available.')
    }
    if (payload.kind === 'walkthrough' && Array.isArray(payload.steps) && payload.steps.length) {
      beginWalkthrough(payload.message || 'Here is a walkthrough.', payload.steps, { id: 'ai' })
      return
    }
    addMessage('fox', payload.message || 'I could not form a safe response for that question.')
  } catch (error) {
    if (state.aiController !== controller) return
    if (error.name === 'AbortError') addMessage('fox','The AI request timed out. Supported demo walkthroughs still work without the provider.',{error:true})
    else addMessage('fox', error.message || 'The AI request failed safely.', { error:true })
  } finally {
    clearTimeout(timeout)
    if (state.aiController === controller) {
      hideTyping()
      state.aiController = null
      elements.send.disabled = false
    }
  }
}

async function submitQuestion(raw) {
  const question = String(raw ?? '').trim(); if (!question) return; elements.input.value=''; addMessage('user',question)
  const scenario = matchScenario(question)
  if (scenario) { cancelAIRequest(); beginScenario(scenario); return }
  showTyping(); elements.send.disabled=true; await askAI(question)
}

elements.form.addEventListener('submit', event => { event.preventDefault(); submitQuestion(elements.input.value) })
elements.input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); elements.form.requestSubmit() } })

elements.scopeButton.addEventListener('click', () => { const expanded = elements.scopeButton.getAttribute('aria-expanded') === 'true'; elements.scopeButton.setAttribute('aria-expanded', String(!expanded)); elements.scopePanel.hidden = expanded })

document.querySelectorAll('input[name="text-size"]').forEach(input => input.addEventListener('change', () => { document.body.classList.remove('text-large','text-xlarge'); if (input.value === 'large') document.body.classList.add('text-large'); if (input.value === 'xlarge') document.body.classList.add('text-xlarge') }))

function configureSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) { elements.voice.disabled=true; elements.voice.title='Speech recognition is unavailable in this browser'; elements.voice.setAttribute('aria-label','Voice input unavailable'); return }
  const recognition = new SpeechRecognition(); recognition.lang='en-US'; recognition.interimResults=false; recognition.maxAlternatives=1; state.recognition=recognition
  recognition.addEventListener('start', () => { elements.voice.textContent='●'; elements.voice.setAttribute('aria-label','Listening for voice input') })
  recognition.addEventListener('end', () => { elements.voice.textContent='🎙'; elements.voice.setAttribute('aria-label','Use voice input') })
  recognition.addEventListener('result', event => { elements.input.value = event.results?.[0]?.[0]?.transcript || ''; elements.input.focus() })
  recognition.addEventListener('error', event => { toast(event.error === 'not-allowed' ? 'Microphone permission was not granted.' : 'Speech recognition was unavailable. You can keep typing instead.') })
  elements.voice.addEventListener('click', () => { try { recognition.start() } catch { toast('Speech recognition is already active or unavailable.') } })
}

let recentClicks = []
elements.sandbox.addEventListener('click', event => {
  if (!state.watching) return; const now=Date.now(); recentClicks=recentClicks.filter(item => now-item.at<=2000); recentClicks.push({x:event.clientX,y:event.clientY,at:now}); const cluster=recentClicks.filter(item => Math.hypot(item.x-event.clientX,item.y-event.clientY)<=60)
  if (cluster.length>=3) { recentClicks=[]; addMessage('fox','It looks like you may want a hand in the demo. I can highlight the current walkthrough control if one is active.',{proactive:true}) }
}, true)
elements.watchingToggle.addEventListener('click', () => { state.watching=!state.watching; elements.watchingToggle.setAttribute('aria-pressed',String(state.watching)); elements.watchingToggle.textContent=state.watching?'Watching demo':'Watching paused'; elements.watchingDot.classList.toggle('active',state.watching) })
elements.proactiveDemo.addEventListener('click', () => addMessage('fox','This is an accelerated portfolio demonstration of proactive help. The desktop application keeps its normal conservative thresholds; this button does not change them.',{proactive:true}))

window.addEventListener('beforeunload', () => { cancelAIRequest(); highlight.destroy() })
renderExamples(); renderDemo(); configureSpeech()
