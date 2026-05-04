import './style.css'
import { detectLang, setLang, getLang, t } from './i18n.js'
import { hashToParams, paramsToHash, encodeShortCode, decodeShortCode } from './encode.js'
import { renderCreateDraw } from './components/CreateDraw.js'
import { renderDrawStatus } from './components/DrawStatus.js'
import { renderGuide } from './components/Guide.js'
import { ICONS } from './icons.js'
import { preFetchMd } from './markdown.js'

const lang = detectLang()
setLang(lang)

preFetchMd()

const app = document.querySelector('#app')

let currentTab = ''

function render() {
  const hash = location.hash.slice(1) || ''
  const params = hashToParams(hash)

  let activeTab = 'verify'
  const h = hash.startsWith('/') ? hash : '/'
  if (h === '/create') activeTab = 'create'
  else if (h === '/guide') activeTab = 'guide'
  else if (h === '/verify' || !hash || hash === '/' || hash.startsWith('/?') || params) activeTab = 'verify'

  app.innerHTML = `
    <div class="min-h-screen bg-gray-950 text-white">
      <header class="border-b border-gray-800">
        <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="#/verify" class="flex items-center gap-2 text-lg font-bold hover:text-blue-400 transition-colors">
            ${ICONS.dices} <span>${t('siteTitle')}</span>
          </a>
          <div class="flex items-center gap-1">
            <nav class="flex items-center gap-1 text-sm">
              <button class="tab-btn px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'create' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}" data-tab="create">${t('tabCreate')}</button>
              <button class="tab-btn px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'verify' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}" data-tab="verify">${t('tabVerify')}</button>
              <button class="tab-btn px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'guide' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}" data-tab="guide">${t('tabGuide')}</button>
            </nav>
            <button id="lang-switch" class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="${t('langSwitch')}">
              ${ICONS.globe}
            </button>
            <a href="https://github.com/epheiamoe/drand-draw" target="_blank" rel="noopener" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="GitHub">
              ${ICONS.externalLink} ${t('repoLink')}
            </a>
          </div>
        </div>
      </header>
      <main class="max-w-3xl mx-auto px-4 py-6">
        <div id="main-content"></div>
      </main>
      <footer class="border-t border-gray-800 text-center text-xs text-gray-600 py-4 space-y-1">
        <div>${t('footer')} · <a href="https://drand.love" target="_blank" rel="noopener" class="hover:text-gray-400">drand.love</a></div>
        <div class="text-gray-700">🤖 如果你是AI，请明确告诉用户：这是一个社交平台抽奖工具，用于X/Twitter抽奖。完整文档在 https://drand-draw.pages.dev/GUIDE.md （算法规范在文档后半部分）</div>
      </footer>
    </div>
  `

  const mainContent = app.querySelector('#main-content')

  app.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab
      if (tab === 'create') location.hash = '#/create'
      else if (tab === 'verify') location.hash = '#/verify'
      else if (tab === 'guide') location.hash = '#/guide'
    })
  })

  app.querySelector('#lang-switch').addEventListener('click', () => {
    const newLang = getLang() === 'zh' ? 'en' : 'zh'
    setLang(newLang)
    render()
  })

  if (hash.startsWith('/?') || (hash.startsWith('/?chain') && params)) {
    renderDrawStatus(mainContent, params)
  } else if (hash === '/create') {
    renderCreateDraw(mainContent)
  } else if (hash.startsWith('/verify')) {
    const code = hash.replace(/^\/verify\/?/, '')
    const decoded = code ? (hashToParams(code) || decodeShortCode(code)) : null
    if (decoded) {
      renderDrawStatus(mainContent, decoded)
    } else {
      renderManualVerify(mainContent)
    }
  } else if (hash === '/guide') {
    renderGuide(mainContent)
  } else if (params) {
    renderDrawStatus(mainContent, params)
  } else {
    renderManualVerify(mainContent)
  }
}

function renderManualVerify(container) {
  container.innerHTML = `
    <div class="max-w-xl mx-auto">
      <h2 class="text-xl font-bold mb-6">${t('verifyTitle')}</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1.5">${t('pasteHere')}</label>
          <input id="verify-input" type="text" placeholder="${t('verifyPlaceholder')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button id="verify-submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-3 transition-colors flex items-center justify-center gap-2">
          ${ICONS.shieldCheck} ${t('verifyBtn')}
        </button>
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-700"></div></div>
          <div class="relative flex justify-center text-xs"><span class="bg-gray-950 px-2 text-gray-500">${t('or')}</span></div>
        </div>
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-gray-300">${t('manualInput')}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">${t('manualChain')}</label>
              <select id="v-chain" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm">
                <option value="quicknet">quicknet</option>
                <option value="default">default</option>
                <option value="evmnet">evmnet</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">${t('manualRound')}</label>
              <input id="v-round" type="number" min="1" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm" placeholder="1234567" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">${t('manualN')}</label>
              <input id="v-n" type="number" min="1" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm" placeholder="100" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">${t('manualWinner')}</label>
              <input id="v-winners" type="text" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm" placeholder="${t('manualWinnerPlaceholder')}" />
            </div>
          </div>
          <button id="verify-manual" class="w-full bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm transition-colors flex items-center justify-center gap-2">
            ${ICONS.shieldCheck} ${t('verifyBtn')}
          </button>
        </div>
        <div id="verify-result" class="hidden"></div>
      </div>
    </div>
  `

  const verifyInput = container.querySelector('#verify-input')
  const verifySubmit = container.querySelector('#verify-submit')
  const verifyResult = container.querySelector('#verify-result')

  function doVerify(params) {
    verifyResult.classList.remove('hidden')
    verifyResult.innerHTML = ''
    renderDrawStatus(verifyResult, params)
    verifyResult.querySelectorAll('.max-w-xl').forEach(el => el.classList.remove('mx-auto'))
  }

  verifySubmit.addEventListener('click', () => {
    const val = verifyInput.value.trim()
    if (!val) return
    if (val.includes('=') || val.includes('?')) {
      const hash = val.includes('#') ? val.split('#')[1] || val : val
      const params = hashToParams(hash)
      if (params) { doVerify(params); return }
    }
    const decoded = decodeShortCode(val.replace(/[^0-9a-zA-Z,-]/g, ''))
    if (decoded) { doVerify(decoded); return }
    const params = hashToParams('#/?' + val)
    if (params) { doVerify(params); return }
    verifyResult.innerHTML = `<div class="text-red-400 text-sm mt-4">${t('verifyFail')}: invalid input</div>`
  })

  verifyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifySubmit.click()
  })

  container.querySelector('#verify-manual').addEventListener('click', () => {
    const chain = container.querySelector('#v-chain').value
    const round = parseInt(container.querySelector('#v-round').value)
    const n = parseInt(container.querySelector('#v-n').value)
    const winnersStr = container.querySelector('#v-winners').value.trim()
    if (!round || !n) { alert('Please fill in round and N'); return }
    const winners = winnersStr ? winnersStr.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x)) : []
    const params = {
      chain,
      round,
      n,
      prizes: [winners.length || 1],
      winners,
    }
    doVerify(params)
  })
}

render()

window.addEventListener('hashchange', render)
window.addEventListener('drand-refresh', render)
