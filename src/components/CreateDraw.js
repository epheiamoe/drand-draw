import { CHAIN_LIST, CHAINS } from '../chains.js'
import { t } from '../i18n.js'
import { computeRound, computeWinners, formatWinnerList } from '../lottery.js'
import { fetchBeacon } from '../api.js'
import { paramsToHash, encodeShortCode } from '../encode.js'
import { ICONS } from '../icons.js'

export function renderCreateDraw(container) {
  container.innerHTML = `
    <div class="max-w-xl mx-auto">
      <h2 class="text-xl font-bold mb-6">${t('tabCreate')}</h2>
      <div class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1.5">${t('chainLabel')}</label>
          <div class="relative">
            <select id="create-chain" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500">
              ${CHAIN_LIST.map(c => `<option value="${c}">${t('chain' + c.charAt(0).toUpperCase() + c.slice(1)) || c}</option>`).join('')}
            </select>
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">${ICONS.chevronDown}</span>
          </div>
          <p id="chain-desc" class="text-xs text-gray-500 mt-1.5"></p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1.5">${t('nLabel')}</label>
          <input id="create-n" type="number" min="1" max="1000000" placeholder="${t('nPlaceholder')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1.5">${t('deadlineLabel')}</label>
          <input id="create-deadline" type="datetime-local" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1.5">${t('tzLabel')}</label>
          <div class="relative">
            <select id="create-tz" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="-12">UTC-12</option>
              <option value="-11">UTC-11</option>
              <option value="-10">UTC-10</option>
              <option value="-9">UTC-9</option>
              <option value="-8">UTC-8</option>
              <option value="-7">UTC-7</option>
              <option value="-6">UTC-6</option>
              <option value="-5">UTC-5</option>
              <option value="-4">UTC-4</option>
              <option value="-3">UTC-3</option>
              <option value="-2">UTC-2</option>
              <option value="-1">UTC-1</option>
              <option value="0">UTC±0</option>
              <option value="1">UTC+1</option>
              <option value="2">UTC+2</option>
              <option value="3">UTC+3</option>
              <option value="4">UTC+4</option>
              <option value="5">UTC+5</option>
              <option value="5.5">UTC+5:30</option>
              <option value="6">UTC+6</option>
              <option value="7">UTC+7</option>
              <option value="8" selected>UTC+8</option>
              <option value="9">UTC+9</option>
              <option value="10">UTC+10</option>
              <option value="11">UTC+11</option>
              <option value="12">UTC+12</option>
            </select>
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">${ICONS.chevronDown}</span>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1.5">${t('prizesLabel')} <span class="text-gray-500 text-xs">(${t('supportMulti')})</span></label>
          <div id="prizes-container" class="space-y-2">
            <div class="prize-row flex items-center gap-2">
              <input type="number" min="1" max="1000" value="1" class="prize-count w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span class="text-gray-400 text-sm prize-label">${t('prizeTier', 0)}</span>
            </div>
          </div>
          <button id="add-prize-btn" class="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">+ ${t('addPrize')}</button>
        </div>
        <button id="create-generate" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-3 transition-colors flex items-center justify-center gap-2">
          ${ICONS.dices} ${t('generateBtn')}
        </button>
      </div>
      <div id="create-result" class="mt-6 hidden"></div>
    </div>
  `

  const chainSelect = container.querySelector('#create-chain')
  const chainDesc = container.querySelector('#chain-desc')
  const nInput = container.querySelector('#create-n')
  const deadlineInput = container.querySelector('#create-deadline')
  const tzSelect = container.querySelector('#create-tz')
  const generateBtn = container.querySelector('#create-generate')
  const prizesContainer = container.querySelector('#prizes-container')
  const resultDiv = container.querySelector('#create-result')

  const now = new Date()
  now.setMinutes(now.getMinutes() + 60)
  deadlineInput.value = now.toISOString().slice(0, 16)

  function updateChainDesc() {
    const c = CHAINS[chainSelect.value]
    const period = c.period < 60 ? `${c.period}s` : `${c.period / 60}m`
    chainDesc.textContent = `${c.scheme} · ${period}/round · genesis ${new Date(c.genesisTime * 1000).toISOString().slice(0, 10)}`
  }
  updateChainDesc()
  chainSelect.addEventListener('change', updateChainDesc)

  container.querySelector('#add-prize-btn').addEventListener('click', () => {
    const rows = prizesContainer.querySelectorAll('.prize-row')
    const idx = rows.length
    const row = document.createElement('div')
    row.className = 'prize-row flex items-center gap-2'
    row.innerHTML = `
      <input type="number" min="1" max="1000" value="1" class="prize-count w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <span class="text-gray-400 text-sm prize-label">${t('prizeTier', idx)}</span>
      <button class="prize-remove text-gray-500 hover:text-red-400 transition-colors">${ICONS.xIcon}</button>
    `
    row.querySelector('.prize-remove').addEventListener('click', () => {
      row.remove()
      updatePrizeLabels()
    })
    prizesContainer.appendChild(row)
  })

  function updatePrizeLabels() {
    const rows = prizesContainer.querySelectorAll('.prize-row')
    rows.forEach((row, i) => {
      row.querySelector('.prize-label').textContent = t('prizeTier', i)
    })
  }

  generateBtn.addEventListener('click', async () => {
    const chain = chainSelect.value
    const n = parseInt(nInput.value)
    if (!n || n < 1) { alert(t('nPlaceholder')); return }
    if (!deadlineInput.value) { alert(t('deadlinePlaceholder')); return }
    const tz = parseFloat(tzSelect.value)
    const localDate = new Date(deadlineInput.value)
    const browserOffset = -localDate.getTimezoneOffset() * 60
    const deadlineUnix = Math.floor(localDate.getTime() / 1000) + browserOffset - tz * 3600
    const nowUnix = Math.floor(Date.now() / 1000)
    if (deadlineUnix <= nowUnix) { alert('Deadline must be in the future'); return }

    const prizeRows = prizesContainer.querySelectorAll('.prize-row')
    const prizes = Array.from(prizeRows).map(row => parseInt(row.querySelector('.prize-count').value)).filter(v => v > 0)
    if (!prizes.length) { alert('Add at least one prize'); return }
    const totalPrizes = prizes.reduce((a, b) => a + b, 0)
    if (totalPrizes > n) { alert(`Total prizes (${totalPrizes}) exceeds N (${n})`); return }

    const round = computeRound(chain, deadlineUnix)
    if (round < 0) { alert('Invalid deadline'); return }

    const params = { chain, deadline: deadlineUnix, n, prizes }
    const url = paramsToHash(params)
    const code = encodeShortCode(params)

    const deadlineDate = new Date(deadlineUnix * 1000)
    const deadlineStr = deadlineDate.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

    resultDiv.classList.remove('hidden')
    resultDiv.innerHTML = `
      <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-4">
        <div class="flex items-center gap-2 text-green-400 font-medium">
          ${ICONS.check} ${chainSelect.value === 'quicknet' ? t('chainQuicknet') : chainSelect.value === 'default' ? t('chainDefault') : t('chainEvmnet')}
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-400">${t('participants')} N</span><br><span class="text-white font-mono">${n}</span></div>
          <div><span class="text-gray-400">${t('deadlineLabel')}</span><br><span class="text-white font-mono">${deadlineStr}</span></div>
          <div><span class="text-gray-400">${t('expectedRound')}</span><br><span class="text-white font-mono">#${round}</span></div>
          <div><span class="text-gray-400">${t('prizesLabel')}</span><br><span class="text-white font-mono">${prizes.join(', ')} ${t('winners')}</span></div>
        </div>
        <div class="space-y-2 pt-2 border-t border-gray-700">
          <button class="copy-btn w-full bg-gray-700 hover:bg-gray-600 text-sm rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-2" data-copy="${window.location.origin + window.location.pathname + '#' + url}">
            ${ICONS.copy} ${t('copyLink')}
          </button>
          <button class="copy-btn w-full bg-gray-700 hover:bg-gray-600 text-sm rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-2" data-copy="${code}">
            ${ICONS.copy} ${t('copyCode')}
          </button>
          <a href="${'#' + url}" class="block text-center text-sm text-blue-400 hover:text-blue-300 mt-2">${t('viewGuide')} →</a>
        </div>
      </div>
    `
    resultDiv.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy
        try {
          await navigator.clipboard.writeText(text)
          const orig = btn.innerHTML
          btn.innerHTML = `${ICONS.check} ${t('copied')}`
          setTimeout(() => btn.innerHTML = orig, 2000)
        } catch { /* fallback */ }
      })
    })
  })
}
