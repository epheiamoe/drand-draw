import { t, getLang } from '../i18n.js'
import { ICONS } from '../icons.js'

export function renderSortTool(container) {
  const lang = getLang()

  container.innerHTML = `
    <div class="mt-8 pt-6 border-t border-gray-700/50">
      <details class="group">
        <summary class="cursor-pointer text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2 select-none">
          <span class="text-gray-500 group-open:text-blue-400 transition-colors">${ICONS.chevronDown}</span>
          ${lang === 'en' ? 'Participant List Sorter — sort and export as images' : '候选列表排序工具 — 排序并导出为图片'}
        </summary>
        <div class="mt-4 space-y-4">
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">
              ${lang === 'en' ? 'Paste handles (supports @handle, spaces, commas, newlines)' : '粘贴参与者列表（支持 @handle、空格、逗号、换行分割）'}
            </label>
            <textarea id="sort-input" rows="5"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="${lang === 'en' ? '@alice @bob @charlie ...' : '@alice @bob @charlie ...'}"></textarea>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 text-xs">
              <span class="text-gray-500">${lang === 'en' ? 'Total:' : '共'} <strong id="sort-count" class="text-white font-mono">0</strong> ${lang === 'en' ? 'participants' : '人'}</span>
              <button id="sort-copy-text" class="text-blue-400 hover:text-blue-300 transition-colors">
                ${ICONS.copy} ${lang === 'en' ? 'Copy sorted text' : '复制排序文本'}
              </button>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-gray-500">${lang === 'en' ? 'Show:' : '显示'}</span>
              <button id="sort-toggle-num" class="text-xs px-2 py-1 rounded bg-gray-700 text-white font-mono">#</button>
            </div>
          </div>

          <div id="sort-preview" class="bg-gray-950 rounded-lg p-3 text-sm font-mono text-gray-300 max-h-48 overflow-y-auto leading-relaxed hidden"></div>

          <div class="grid grid-cols-2 gap-2">
            <button id="sort-mode-column" class="flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              ${ICONS.listChecks || ICONS.chevronDown} ${lang === 'en' ? 'Single Column' : '一行一列'}
            </button>
            <button id="sort-mode-square" class="flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              ${ICONS.grid3x3 || ICONS.chevronDown} ${lang === 'en' ? 'Square Grid' : '尽量正方形'}
            </button>
          </div>

          <div id="sort-images-output" class="space-y-3 hidden"></div>
          <div id="sort-loading" class="text-center text-xs text-gray-500 hidden">${lang === 'en' ? 'Generating images...' : '生成图片中...'}</div>
        </div>
      </details>
    </div>
  `

  const input = container.querySelector('#sort-input')
  const preview = container.querySelector('#sort-preview')
  const countEl = container.querySelector('#sort-count')
  const copyBtn = container.querySelector('#sort-copy-text')
  const toggleNum = container.querySelector('#sort-toggle-num')
  const modeColumn = container.querySelector('#sort-mode-column')
  const modeSquare = container.querySelector('#sort-mode-square')
  const outputDiv = container.querySelector('#sort-images-output')
  const loadingDiv = container.querySelector('#sort-loading')

  let showNumbers = true
  let currentHandles = []

  toggleNum.addEventListener('click', () => {
    showNumbers = !showNumbers
    toggleNum.classList.toggle('bg-gray-700', showNumbers)
    toggleNum.classList.toggle('bg-gray-600', !showNumbers)
    if (currentHandles.length > 0) renderPreview()
  })

  input.addEventListener('input', () => {
    const raw = input.value
    const handles = parseHandles(raw)
    currentHandles = handles
    countEl.textContent = handles.length
    const nInput = document.getElementById('create-n')
    if (nInput && handles.length > 0) nInput.value = handles.length
    outputDiv.classList.add('hidden')
    modeColumn.disabled = handles.length === 0
    modeSquare.disabled = handles.length === 0
    if (handles.length > 0) {
      renderPreview()
    } else {
      preview.classList.add('hidden')
    }
  })

  function renderPreview() {
    const items = currentHandles.map((h, i) => showNumbers ? `${i}. @${h}` : `@${h}`)
    preview.classList.remove('hidden')
    preview.innerHTML = items.join('\n')
  }

  copyBtn.addEventListener('click', () => {
    if (currentHandles.length === 0) return
    const text = currentHandles.map((h, i) => `${i}. @${h}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      const orig = copyBtn.innerHTML
      copyBtn.innerHTML = `${ICONS.check} ${t('copied')}`
      setTimeout(() => copyBtn.innerHTML = orig, 2000)
    }).catch(() => {})
  })

  modeColumn.addEventListener('click', () => generateImages('column'))
  modeSquare.addEventListener('click', () => generateImages('square'))

  async function generateImages(mode) {
    if (currentHandles.length === 0) return
    loadingDiv.classList.remove('hidden')
    outputDiv.classList.add('hidden')
    outputDiv.innerHTML = ''

    await new Promise(r => setTimeout(r, 50))

    try {
      const blobs = await renderListImages(currentHandles, mode)
      outputDiv.classList.remove('hidden')

      for (let i = 0; i < blobs.length; i++) {
        const url = URL.createObjectURL(blobs[i])
        const wrapper = document.createElement('div')
        wrapper.className = 'bg-gray-900/50 rounded-lg p-3 space-y-2'
        wrapper.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-400">${blobs.length > 1 ? `Page ${i + 1}/${blobs.length}` : ''}</span>
            <a href="${url}" download="participants-${i + 1}.png" class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">${ICONS.download || ICONS.copy} Download</a>
          </div>
          <img src="${url}" class="w-full rounded border border-gray-700/50" alt="Participant list page ${i + 1}" />
        `
        outputDiv.appendChild(wrapper)
      }
    } catch (err) {
      outputDiv.innerHTML = `<div class="text-red-400 text-xs">Error: ${err.message}</div>`
    }

    loadingDiv.classList.add('hidden')
  }
}

function parseHandles(raw) {
  const cleaned = raw
    .replace(/[,，、\s]+/g, ' ')     // normalize separators to spaces
    .replace(/@/g, '')               // remove @ symbols
    .trim()
  if (!cleaned) return []
  const handles = [...new Set(
    cleaned.split(/\s+/).filter(h => h.length > 0)
  )]
  handles.sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
  return handles
}

function canvasToBlobAsync(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

async function renderListImages(handles, mode) {
  const PAD = 24
  const W = 600
  const ROW_H = 30
  const HEADER_H = 48
  const FOOTER_H = 32
  const MAX_H = 8000
  const NUM_W = 44
  const FONT_FAMILY = 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'

  if (mode === 'column') {
    const itemsPerPage = Math.floor((MAX_H - HEADER_H - FOOTER_H) / ROW_H)
    const pages = Math.ceil(handles.length / itemsPerPage)
    const blobs = []

    for (let p = 0; p < pages; p++) {
      const pageItems = handles.slice(p * itemsPerPage, (p + 1) * itemsPerPage)
      const h = HEADER_H + pageItems.length * ROW_H + FOOTER_H
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = h
      const ctx = canvas.getContext('2d')

      // Background
      ctx.fillStyle = '#030712'
      ctx.fillRect(0, 0, W, h)

      // Header
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, '#0f172a')
      grad.addColorStop(1, '#1e293b')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, HEADER_H)

      ctx.fillStyle = '#60a5fa'
      ctx.font = `bold 14px ${FONT_FAMILY}`
      ctx.fillText('Participant List', PAD, 20)
      ctx.fillStyle = '#6b7280'
      ctx.font = `12px ${FONT_FAMILY}`
      ctx.fillText(`Total: ${handles.length}`, PAD, 38)
      if (pages > 1) {
        ctx.fillStyle = '#4b5563'
        ctx.font = `12px ${FONT_FAMILY}`
        ctx.textAlign = 'right'
        ctx.fillText(`${p + 1} / ${pages}`, W - PAD, 20)
        ctx.textAlign = 'left'
      }

      // Rows
      for (let i = 0; i < pageItems.length; i++) {
        const y = HEADER_H + i * ROW_H
        if (i % 2 === 0) {
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(PAD, y, W - 2 * PAD, ROW_H)
        }

        const globalIdx = p * itemsPerPage + i
        const num = `${globalIdx}.`

        ctx.fillStyle = '#4b5563'
        ctx.font = `12px ${FONT_FAMILY}`
        ctx.fillText(num, PAD + 4, y + ROW_H / 2 + 4)

        const handle = `@${pageItems[i]}`
        ctx.fillStyle = '#e5e7eb'
        ctx.font = `14px ${FONT_FAMILY}`
        const maxW = W - 2 * PAD - NUM_W - 12
        let displayText = handle
        if (ctx.measureText(displayText).width > maxW) {
          while (ctx.measureText(displayText + '…').width > maxW && displayText.length > 1) {
            displayText = displayText.slice(0, -1)
          }
          displayText += '…'
        }
        ctx.fillText(displayText, PAD + NUM_W + 4, y + ROW_H / 2 + 4)

        // Divider
        ctx.strokeStyle = '#1f2937'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(PAD, y + ROW_H)
        ctx.lineTo(W - PAD, y + ROW_H)
        ctx.stroke()
      }

      // Footer
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(0, h - FOOTER_H, W, FOOTER_H)
      ctx.fillStyle = '#374151'
      ctx.font = `11px ${FONT_FAMILY}`
      ctx.textAlign = 'center'
      ctx.fillText('drand-draw.pages.dev', W / 2, h - FOOTER_H / 2 + 4)
      ctx.textAlign = 'left'

      blobs.push(await canvasToBlobAsync(canvas))
    }
    return blobs
  }

  // Square mode
  const CELL_W = 176
  const CELL_H = 28
  const cols = Math.max(2, Math.ceil(Math.sqrt(handles.length * CELL_H / CELL_W)))
  const rowsPerPage = Math.ceil(handles.length / cols)
  const maxRowsPerImage = Math.ceil((2000 - HEADER_H - FOOTER_H) / CELL_H)
  const totalRows = rowsPerPage
  const rowPages = Math.ceil(totalRows / maxRowsPerImage)
  const blobs = []

  for (let rp = 0; rp < rowPages; rp++) {
    const startRow = rp * maxRowsPerImage
    const endRow = Math.min(totalRows, startRow + maxRowsPerImage)
    const rowsHere = endRow - startRow
    const imgW = PAD * 2 + cols * CELL_W
    const imgH = HEADER_H + rowsHere * CELL_H + FOOTER_H
    const canvas = document.createElement('canvas')
    canvas.width = imgW
    canvas.height = imgH
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#030712'
    ctx.fillRect(0, 0, imgW, imgH)

    // Header
    const grad = ctx.createLinearGradient(0, 0, imgW, 0)
    grad.addColorStop(0, '#0f172a')
    grad.addColorStop(1, '#1e293b')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, imgW, HEADER_H)
    ctx.fillStyle = '#60a5fa'
    ctx.font = `bold 14px ${FONT_FAMILY}`
    ctx.fillText('Participant List', PAD, 20)
    ctx.fillStyle = '#6b7280'
    ctx.font = `12px ${FONT_FAMILY}`
    ctx.fillText(`Total: ${handles.length}`, PAD, 38)
    if (rowPages > 1) {
      ctx.fillStyle = '#4b5563'
      ctx.font = `12px ${FONT_FAMILY}`
      ctx.textAlign = 'right'
      ctx.fillText(`${rp + 1} / ${rowPages}`, imgW - PAD, 20)
      ctx.textAlign = 'left'
    }

    // Grid rows
    for (let row = startRow; row < endRow; row++) {
      const ry = HEADER_H + (row - startRow) * CELL_H
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col
        if (idx >= handles.length) break
        const x = PAD + col * CELL_W
        const y = ry

        if ((row * cols + col) % 2 === 0) {
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(x, y, CELL_W, CELL_H)
        }

        const num = `${idx}.`
        ctx.fillStyle = '#4b5563'
        ctx.font = `10px ${FONT_FAMILY}`
        ctx.fillText(num, x + 3, y + CELL_H / 2 + 3)

        const handle = `@${handles[idx]}`
        ctx.fillStyle = '#e5e7eb'
        ctx.font = `12px ${FONT_FAMILY}`
        const maxW = CELL_W - 36
        let displayText = handle
        if (ctx.measureText(displayText).width > maxW) {
          while (ctx.measureText(displayText + '…').width > maxW && displayText.length > 1) {
            displayText = displayText.slice(0, -1)
          }
          displayText += '…'
        }
        ctx.fillText(displayText, x + 32, y + CELL_H / 2 + 3.5)
      }
    }

    // Footer
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, imgH - FOOTER_H, imgW, FOOTER_H)
    ctx.fillStyle = '#374151'
    ctx.font = `11px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.fillText('drand-draw.pages.dev', imgW / 2, imgH - FOOTER_H / 2 + 4)
    ctx.textAlign = 'left'

    blobs.push(await canvasToBlobAsync(canvas))
  }
  return blobs
}
