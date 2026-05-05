import { CHAINS } from '../chains.js'
import { t } from '../i18n.js'
import { computeWinners, formatWinnerList } from '../lottery.js'
import { fetchBeacon } from '../api.js'
import { paramsToHash, encodeShortCode } from '../encode.js'
import { ICONS } from '../icons.js'

async function fetchWithRetry(chain, round, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchBeacon(chain, round)
    } catch {
      if (attempt >= maxRetries - 1) throw new Error('Failed to fetch beacon after retries')
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}

export function renderDrawStatus(container, params) {
  if (!params || !params.chain || !params.n) {
    container.innerHTML = `<div class="text-center text-gray-400 py-10">${t('manualInput')}</div>`
    return
  }

  const chain = CHAINS[params.chain]
  if (!chain) {
    container.innerHTML = `<div class="text-center text-red-400 py-10">Unknown chain: ${params.chain}</div>`
    return
  }

  const n = params.n
  const prizes = params.prizes && params.prizes.length ? params.prizes : [1]
  const hasWinners = params.winners && params.winners.length > 0

  if (params.round) {
    if (hasWinners) {
      renderVerifiedByRound(container, params, chain, prizes, n)
    } else {
      renderByRound(container, params, chain, prizes, n)
    }
    return
  }

  if (!params.deadline) {
    container.innerHTML = `<div class="text-center text-gray-400 py-10">${t('manualInput')}</div>`
    return
  }

  const deadlineMs = params.deadline * 1000
  const now = Date.now()
  const isExpired = now >= deadlineMs

  const deadlineDate = new Date(deadlineMs)
  const deadlineStr = deadlineDate.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  if (!isExpired) {
    renderCountdown(container, params, deadlineMs, deadlineStr, chain, prizes)
    startCountdown(container, deadlineMs)
  } else if (!hasWinners) {
    renderAwaitDraw(container, params, deadlineStr, chain, prizes, n)
  } else {
    renderVerified(container, params, deadlineStr, chain, prizes, n)
  }
}

function renderCountdown(container, params, deadlineMs, deadlineStr, chain, prizes) {
  const remaining = Math.max(0, deadlineMs - Date.now())
  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  const mins = Math.floor((remaining % 3600000) / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)

  const round = Math.floor((params.deadline - chain.genesisTime) / chain.period) + 1

  container.innerHTML = `
    <div class="max-w-xl mx-auto">
      <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-5">
        <div class="flex items-center gap-3 text-amber-400 font-medium text-lg">
          ${ICONS.clock} ${t('notOpenYet')}
        </div>
        <div class="text-center">
          <div class="text-3xl font-mono font-bold text-white countdown-display" data-deadline="${deadlineMs}">
            ${days > 0 ? days + 'd ' : ''}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}
          </div>
          <div class="text-sm text-gray-400 mt-1">${t('countdown')}</div>
          <div class="text-sm text-gray-500 mt-1">${deadlineStr}</div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-400">${t('chain')}</span><br><span class="text-white font-mono">${params.chain}</span></div>
          <div><span class="text-gray-400">${t('participants')} N</span><br><span class="text-white font-mono">${params.n}</span></div>
          <div><span class="text-gray-400">${t('expectedRound')}</span><br><span class="text-white font-mono">#${round}</span></div>
          <div><span class="text-gray-400">${t('prizesLabel')}</span><br><span class="text-white font-mono">${prizes.join(', ')} ${t('winners')}</span></div>
        </div>
        <div class="text-xs text-gray-500 text-center">
          ${t('guideNote')}: ${t('guideNote1')}
        </div>
      </div>
    </div>
  `
}

function startCountdown(container, deadlineMs) {
  if (window._countdownInterval) clearInterval(window._countdownInterval)
  window._countdownInterval = setInterval(() => {
    const display = container.querySelector('.countdown-display')
    if (!display) { clearInterval(window._countdownInterval); return }
    const remaining = Math.max(0, deadlineMs - Date.now())
    if (remaining <= 0) {
      clearInterval(window._countdownInterval)
      window.dispatchEvent(new CustomEvent('drand-refresh'))
      return
    }
    const days = Math.floor(remaining / 86400000)
    const hours = Math.floor((remaining % 86400000) / 3600000)
    const mins = Math.floor((remaining % 3600000) / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    display.textContent = days > 0 ? `${days}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }, 1000)
}

function renderAwaitDraw(container, params, deadlineStr, chain, prizes, n) {
  container.innerHTML = `
    <div class="max-w-xl mx-auto">
      <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-5">
        <div class="flex items-center gap-3 text-amber-400 font-medium text-lg">
          ${ICONS.clock} ${t('expired')}
        </div>
        <div class="text-sm text-gray-400 text-center">${deadlineStr}</div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-400">${t('chain')}</span><br><span class="text-white font-mono">${params.chain}</span></div>
          <div><span class="text-gray-400">${t('participants')} N</span><br><span class="text-white font-mono">${n}</span></div>
          <div><span class="text-gray-400">${t('prizesLabel')}</span><br><span class="text-white font-mono">${prizes.join(', ')} ${t('winners')}</span></div>
        </div>
        <div class="text-center text-gray-400 text-sm py-4">
          ${t('manualDraw')}
        </div>
        <button id="do-draw-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-3 transition-colors flex items-center justify-center gap-2">
          ${ICONS.dices} ${t('drawBtn')}
        </button>
        <div id="draw-error" class="text-red-400 text-sm text-center hidden"></div>
        <div id="draw-result" class="hidden"></div>
      </div>
    </div>
  `

  const drawBtn = container.querySelector('#do-draw-btn')
  const drawError = container.querySelector('#draw-error')
  const drawResult = container.querySelector('#draw-result')

  drawBtn.addEventListener('click', async () => {
    drawBtn.disabled = true
    drawBtn.innerHTML = `${ICONS.refreshCw} ${t('drawingBtn')}`
    drawError.classList.add('hidden')

    try {
      const round = Math.floor((params.deadline - chain.genesisTime) / chain.period) + 1
      let beacon
      let attempts = 0
      while (attempts < 5) {
        try {
          beacon = await fetchBeacon(params.chain, round)
          break
        } catch {
          attempts++
          if (attempts >= 5) throw new Error('Failed to fetch after retries')
          await new Promise(r => setTimeout(r, 3000))
        }
      }

      const winners = await computeWinners(beacon.randomness, n, prizes)

      const resultParams = { ...params, winners }
      const url = paramsToHash(resultParams)
      const code = encodeShortCode(resultParams)
      const grouped = formatWinnerList(winners, prizes)

      const shareText = [
        `chain: ${params.chain}`,
        `deadline: ${deadlineStr}`,
        `round: #${beacon.round}`,
        `N: ${n}`,
        `randomness: ${beacon.randomness.slice(0, 20)}...`,
        `winners: ${winners.join(', ')}`,
        `verify: ${window.location.origin + window.location.pathname + '#' + url}`,
        `code: ${code}`,
      ].join('\n')

      drawResult.classList.remove('hidden')
      drawResult.innerHTML = `
        <div class="border-t border-gray-700 pt-4 space-y-4">
          <div class="flex items-center gap-2 text-green-400 font-medium">
            ${ICONS.partyPopper} ${t('drawResult')}
          </div>
          <div class="bg-gray-900/50 rounded-lg p-4 space-y-3">
            <div class="text-sm">
              <div class="text-gray-400">${t('round')}</div>
              <div class="text-white font-mono">#${beacon.round}</div>
            </div>
            <div class="text-sm">
              <div class="text-gray-400">${t('randomness')}</div>
              <div class="text-white font-mono text-xs break-all">${beacon.randomness}</div>
            </div>
            ${grouped.map((tierWinners, i) => `
              <div class="text-sm">
                <div class="text-gray-400">${t('prizeTier', i)} (${prizes[i]} ${t('winners')})</div>
                <div class="text-white font-mono">${tierWinners.map(w => '#' + w).join(', ')}</div>
              </div>
            `).join('')}
          </div>
          <div class="space-y-2">
            <button class="copy-btn w-full bg-gray-700 hover:bg-gray-600 text-sm rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-2" data-copy="${window.location.origin + window.location.pathname + '#' + url}">
              ${ICONS.copy} ${t('copyLink')}
            </button>
            <button class="copy-btn w-full bg-gray-700 hover:bg-gray-600 text-sm rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-2" data-copy="${code}">
              ${ICONS.copy} ${t('copyCode')}
            </button>
            <button class="copy-btn w-full bg-gray-700 hover:bg-gray-600 text-sm rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-2" data-copy="${shareText}">
              ${ICONS.copy} ${t('copyShareText')}
            </button>
          </div>
          <div class="text-xs text-gray-600">
            <pre class="whitespace-pre-wrap">${shareText}</pre>
          </div>
        </div>
      `

      drawResult.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(btn.dataset.copy)
            const orig = btn.innerHTML
            btn.innerHTML = `${ICONS.check} ${t('copied')}`
            setTimeout(() => btn.innerHTML = orig, 2000)
          } catch { /* */ }
        })
      })

      history.replaceState(null, '', '#' + url)
      drawBtn.remove()
    } catch (err) {
      drawError.textContent = err.message
      drawError.classList.remove('hidden')
      drawBtn.disabled = false
      drawBtn.innerHTML = `${ICONS.dices} ${t('drawBtn')}`
    }
  })
}

function renderVerified(container, params, deadlineStr, chain, prizes, n) {
  const round = Math.floor((params.deadline - chain.genesisTime) / chain.period) + 1
  const claimed = params.winners || []
  const code = encodeShortCode(params)

  container.innerHTML = `
    <div class="max-w-xl mx-auto">
      <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-5">
        <div class="flex items-center gap-3 text-lg font-medium">
          <span class="text-gray-400">${ICONS.search}</span>
          <span class="text-white">${t('verifyTitle')}</span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-400">${t('chain')}</span><br><span class="text-white font-mono">${params.chain}</span></div>
          <div><span class="text-gray-400">${t('deadlineLabel')}</span><br><span class="text-white font-mono">${deadlineStr}</span></div>
          <div><span class="text-gray-400">${t('round')}</span><br><span class="text-white font-mono">#${round}</span></div>
          <div><span class="text-gray-400">${t('participants')} N</span><br><span class="text-white font-mono">${n}</span></div>
          <div><span class="text-gray-400">${t('prizesLabel')}</span><br><span class="text-white font-mono">${prizes.join(', ')} ${t('winners')}</span></div>
          <div><span class="text-gray-400">${t('claimedWinner')}</span><br><span class="text-white font-mono">${claimed.join(', ')}</span></div>
        </div>
        <div id="verify-status">
          <div class="text-center text-gray-400 py-4 flex items-center justify-center gap-2">
            ${ICONS.refreshCw} ${t('verifyingBtn')}
          </div>
        </div>
      </div>
    </div>
  `

  performVerification(container, params, chain, round, prizes, n, claimed)
}

async function performVerification(container, params, chain, round, prizes, n, claimed) {
  const statusDiv = container.querySelector('#verify-status')
  try {
    const beacon = await fetchWithRetry(params.chain, round)
    const computed = await computeWinners(beacon.randomness, n, prizes)
    const match = computed.length === claimed.length && computed.every((v, i) => v === claimed[i])
    const grouped = formatWinnerList(computed, prizes)

    statusDiv.innerHTML = match ? `
      <div class="border-t border-gray-700 pt-4 space-y-3">
        <div class="flex items-center gap-2 text-green-400 font-medium text-lg">
          ${ICONS.shieldCheck} ${t('verifySuccess')}
        </div>
        <div class="text-sm text-gray-300">${t('verifyDesc')}</div>
        <div class="bg-gray-900/50 rounded-lg p-4 space-y-2 text-sm">
          <div><span class="text-gray-400">${t('randomness')}:</span> <span class="text-white font-mono text-xs break-all">${beacon.randomness}</span></div>
          ${grouped.map((tierWinners, i) => `
            <div><span class="text-gray-400">${t('prizeTier', i)}:</span> <span class="text-green-400 font-mono">${tierWinners.map(w => '#' + w).join(', ')}</span></div>
          `).join('')}
        </div>
        <div class="text-xs text-gray-500 mt-2">
          <pre class="whitespace-pre-wrap">${[
            `chain: ${params.chain}`,
            `round: #${beacon.round}`,
            `deadline: ${new Date(params.deadline * 1000).toISOString().replace('T', ' ').slice(0, 16)} UTC`,
            `N: ${n}`,
            `randomness: ${beacon.randomness}`,
            `winners: ${computed.join(', ')}`,
          ].join('\n')}</pre>
        </div>
      </div>
    ` : `
      <div class="border-t border-gray-700 pt-4 space-y-3">
        <div class="flex items-center gap-2 text-red-400 font-medium text-lg">
          ${ICONS.xIcon} ${t('verifyFail')}
        </div>
        <div class="text-sm text-gray-300">${t('verifyDescFail')}</div>
        <div class="bg-gray-900/50 rounded-lg p-4 space-y-2 text-sm">
          <div><span class="text-gray-400">${t('randomness')}:</span> <span class="text-white font-mono text-xs break-all">${beacon.randomness}</span></div>
          ${grouped.map((tierWinners, i) => `
            <div><span class="text-gray-400">${t('prizeTier', i)} (${t('claimedWinner')}):</span> <span class="text-white font-mono">${claimed.slice(prizes.slice(0, i).reduce((a, b) => a + b, 0), prizes.slice(0, i + 1).reduce((a, b) => a + b, 0)).join(', ') || '—'}</span></div>
            <div><span class="text-gray-400">${t('prizeTier', i)} (${t('computedWinner')}):</span> <span class="text-amber-400 font-mono">${tierWinners.map(w => '#' + w).join(', ')}</span></div>
          `).join('')}
        </div>
      </div>
    `
  } catch (err) {
    statusDiv.innerHTML = `
      <div class="border-t border-gray-700 pt-4">
        <div class="flex items-center gap-2 text-red-400 font-medium">
          ${ICONS.alertTriangle} ${t('verifyFail')}
        </div>
        <div class="text-sm text-gray-400 mt-2">${err.message}</div>
      </div>
    `
  }
}

function renderByRound(container, params, chain, prizes, n) {
  container.innerHTML = `
    <div class="max-w-xl mx-auto">
      <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-5">
        <div class="flex items-center gap-3 text-lg font-medium">
          <span class="text-gray-400">${ICONS.search}</span>
          <span class="text-white">${t('verifyTitle')}</span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-400">${t('chain')}</span><br><span class="text-white font-mono">${params.chain}</span></div>
          <div><span class="text-gray-400">${t('round')}</span><br><span class="text-white font-mono">#${params.round}</span></div>
          <div><span class="text-gray-400">${t('participants')} N</span><br><span class="text-white font-mono">${n}</span></div>
          <div><span class="text-gray-400">${t('prizesLabel')}</span><br><span class="text-white font-mono">${prizes.join(', ')} ${t('winners')}</span></div>
        </div>
        <div id="verify-status">
          <div class="text-center text-gray-400 py-4 flex items-center justify-center gap-2">
            ${ICONS.refreshCw} ${t('verifyingBtn')}
          </div>
        </div>
      </div>
    </div>
  `
  performVerificationByRound(container, params.chain, params.round, prizes, n, params.winners || [])
}

function renderVerifiedByRound(container, params, chain, prizes, n) {
  container.innerHTML = `
    <div class="max-w-xl mx-auto">
      <div class="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-5">
        <div class="flex items-center gap-3 text-lg font-medium">
          <span class="text-gray-400">${ICONS.search}</span>
          <span class="text-white">${t('verifyTitle')}</span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-400">${t('chain')}</span><br><span class="text-white font-mono">${params.chain}</span></div>
          <div><span class="text-gray-400">${t('round')}</span><br><span class="text-white font-mono">#${params.round}</span></div>
          <div><span class="text-gray-400">${t('participants')} N</span><br><span class="text-white font-mono">${n}</span></div>
          <div><span class="text-gray-400">${t('prizesLabel')}</span><br><span class="text-white font-mono">${prizes.join(', ')} ${t('winners')}</span></div>
          <div><span class="text-gray-400">${t('claimedWinner')}</span><br><span class="text-white font-mono">${params.winners.join(', ')}</span></div>
        </div>
        <div id="verify-status">
          <div class="text-center text-gray-400 py-4 flex items-center justify-center gap-2">
            ${ICONS.refreshCw} ${t('verifyingBtn')}
          </div>
        </div>
      </div>
    </div>
  `
  performVerificationByRound(container, params.chain, params.round, prizes, n, params.winners)
}

async function performVerificationByRound(container, chainId, round, prizes, n, claimed) {
  const statusDiv = container.querySelector('#verify-status')
  try {
    const beacon = await fetchWithRetry(chainId, round)
    const computed = await computeWinners(beacon.randomness, n, prizes)
    const match = computed.length === claimed.length && computed.every((v, i) => v === claimed[i])
    const grouped = formatWinnerList(computed, prizes)

    statusDiv.innerHTML = match ? `
      <div class="border-t border-gray-700 pt-4 space-y-3">
        <div class="flex items-center gap-2 text-green-400 font-medium text-lg">
          ${ICONS.shieldCheck} ${t('verifySuccess')}
        </div>
        <div class="text-sm text-gray-300">${t('verifyDesc')}</div>
        <div class="bg-gray-900/50 rounded-lg p-4 space-y-2 text-sm">
          <div><span class="text-gray-400">${t('randomness')}:</span> <span class="text-white font-mono text-xs break-all">${beacon.randomness}</span></div>
          ${grouped.map((tierWinners, i) => `
            <div><span class="text-gray-400">${t('prizeTier', i)}:</span> <span class="text-green-400 font-mono">${tierWinners.map(w => '#' + w).join(', ')}</span></div>
          `).join('')}
        </div>
        <div class="text-xs text-gray-500 mt-2"><pre class="whitespace-pre-wrap">${[
          `chain: ${chainId}`, `round: #${beacon.round}`,
          `N: ${n}`, `randomness: ${beacon.randomness}`,
          `winners: ${computed.join(', ')}`,
        ].join('\n')}</pre></div>
      </div>
    ` : `
      <div class="border-t border-gray-700 pt-4 space-y-3">
        <div class="flex items-center gap-2 text-red-400 font-medium text-lg">
          ${ICONS.xIcon} ${t('verifyFail')}
        </div>
        <div class="text-sm text-gray-300">${t('verifyDescFail')}</div>
        <div class="bg-gray-900/50 rounded-lg p-4 space-y-2 text-sm">
          <div><span class="text-gray-400">${t('randomness')}:</span> <span class="text-white font-mono text-xs break-all">${beacon.randomness}</span></div>
          <div><span class="text-gray-400">${t('claimedWinner')}:</span> <span class="text-white font-mono">${claimed.join(', ') || '—'}</span></div>
          <div><span class="text-gray-400">${t('computedWinner')}:</span> <span class="text-amber-400 font-mono">${computed.map(w => '#' + w).join(', ')}</span></div>
        </div>
      </div>
    `
  } catch (err) {
    statusDiv.innerHTML = `
      <div class="border-t border-gray-700 pt-4">
        <div class="flex items-center gap-2 text-red-400 font-medium">
          ${ICONS.alertTriangle} ${t('verifyFail')}
        </div>
        <div class="text-sm text-gray-400 mt-2">${err.message}</div>
      </div>
    `
  }
}
