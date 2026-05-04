const mdCache = {}

export function getCachedMd(lang) {
  const key = lang === 'en' ? '/GUIDE_EN.md' : '/GUIDE.md'
  return mdCache[key] || null
}

export async function preFetchMd() {
  const files = ['/GUIDE.md', '/GUIDE_EN.md']
  await Promise.all(files.map(async (f) => {
    try {
      const res = await fetch(f)
      if (res.ok) mdCache[f] = await res.text()
    } catch { /* ignore */ }
  }))
}

export function mdToHtml(md) {
  const lines = md.split('\n')
  const html = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    const codeBlock = parseCodeBlock(lines, i)
    if (codeBlock) {
      html.push(codeBlock.html)
      i = codeBlock.nextIndex
      continue
    }

    const table = parseTable(lines, i)
    if (table) {
      html.push(table.html)
      i = table.nextIndex
      continue
    }

    const header = parseHeader(line)
    if (header) {
      html.push(header)
      i++
      continue
    }

    if (/^-{3,}$/.test(line.trim())) {
      html.push('<hr>')
      i++
      continue
    }

    const blockquote = parseBlockquote(lines, i)
    if (blockquote) {
      html.push(blockquote.html)
      i = blockquote.nextIndex
      continue
    }

    const ul = parseUnorderedList(lines, i)
    if (ul) {
      html.push(ul.html)
      i = ul.nextIndex
      continue
    }

    const ol = parseOrderedList(lines, i)
    if (ol) {
      html.push(ol.html)
      i = ol.nextIndex
      continue
    }

    html.push(parseParagraph(lines, i))
    i++
  }

  return html.join('\n')
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineFormat(text) {
  let t = text
  t = t.replace(/`([^`]+)`/g, '<code class="text-sm bg-gray-800 px-1 rounded">$1</code>')
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">$1</a>')
  return t
}

function parseHeader(line) {
  const m = line.match(/^(#{1,4})\s+(.+)$/)
  if (!m) return null
  const level = m[1].length
  const tag = 'h' + level
  const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base']
  const cls = `${sizes[level - 1] || 'text-lg'} font-bold text-white mt-6 mb-3`
  return `<${tag} class="${cls}">${inlineFormat(m[2].trim())}</${tag}>`
}

function parseCodeBlock(lines, start) {
  const m = lines[start].match(/^```(\w*)$/)
  if (!m) return null
  const lang = m[1]
  const codeLines = []
  let i = start + 1
  while (i < lines.length && !lines[i].startsWith('```')) {
    codeLines.push(lines[i])
    i++
  }
  if (i < lines.length) i++
  const code = escapeHtml(codeLines.join('\n'))
  return {
    html: `<pre class="bg-gray-950 text-gray-200 text-sm leading-relaxed p-4 rounded-lg overflow-x-auto border border-gray-700/50 my-4"><code>${code}</code></pre>`,
    nextIndex: i,
  }
}

function parseTable(lines, start) {
  if (!lines[start].includes('|')) return null
  const headerMatch = lines[start].match(/^\|(.+)\|$/)
  if (!headerMatch) return null
  const headerCells = headerMatch[1].split('|').map(s => s.trim()).filter(s => s)
  if (headerCells.length === 0) return null

  let i = start + 1
  if (i >= lines.length) return null
  const sepMatch = lines[i].match(/^\|(.+)\|$/)
  if (!sepMatch) return null

  const sepCells = sepMatch[1].split('|').map(s => s.trim()).filter(s => s)
  if (sepCells.length !== headerCells.length) return null
  if (!sepCells.every(s => /^[-:]+\|?$/.test(s.replace(/ /g, '')))) return null

  i++
  const rows = []
  while (i < lines.length && lines[i].includes('|') && lines[i].match(/^\|(.+)\|$/)) {
    const cells = lines[i].match(/^\|(.+)\|$/)[1].split('|').map(s => s.trim())
    rows.push(cells)
    i++
  }

  let html = '<div class="overflow-x-auto my-4"><table class="w-full text-base border-collapse">'
  html += '<thead><tr class="text-gray-400 border-b border-gray-700">'
  for (const cell of headerCells) {
    html += `<th class="text-left py-2 pr-4 font-semibold">${inlineFormat(cell)}</th>`
  }
  html += '</tr></thead><tbody>'
  for (const row of rows) {
    html += '<tr class="border-b border-gray-800">'
    for (const cell of row) {
      html += `<td class="py-2 pr-4 text-gray-300 text-sm">${inlineFormat(cell)}</td>`
    }
    html += '</tr>'
  }
  html += '</tbody></table></div>'

  return { html, nextIndex: i }
}

function parseBlockquote(lines, start) {
  if (!lines[start].startsWith('>')) return null
  const quoteLines = []
  let i = start
  while (i < lines.length && lines[i].startsWith('>')) {
    quoteLines.push(lines[i].replace(/^>\s?/, ''))
    i++
  }
  const content = quoteLines.map(l => inlineFormat(l)).join('<br>')
  return {
    html: `<blockquote class="border-l-4 border-gray-600 pl-4 my-4 text-sm text-gray-400 italic">${content}</blockquote>`,
    nextIndex: i,
  }
}

function parseUnorderedList(lines, start) {
  if (!lines[start].match(/^-\s/)) return null
  let i = start
  const items = []
  while (i < lines.length && lines[i].match(/^-\s/)) {
    items.push(inlineFormat(lines[i].replace(/^-\s+/, '')))
    i++
  }
  return {
    html: '<ul class="list-disc list-inside text-base text-gray-300 space-y-1.5 my-3">' + items.map(item => `<li>${item}</li>`).join('') + '</ul>',
    nextIndex: i,
  }
}

function parseOrderedList(lines, start) {
  if (!lines[start].match(/^\d+\.\s/)) return null
  let i = start
  const items = []
  while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
    items.push(inlineFormat(lines[i].replace(/^\d+\.\s+/, '')))
    i++
  }
  return {
    html: '<ol class="list-decimal list-inside text-base text-gray-300 space-y-1.5 my-3">' + items.map(item => `<li>${item}</li>`).join('') + '</ol>',
    nextIndex: i,
  }
}

function parseParagraph(lines, start) {
  const text = lines[start]
  if (!text.trim()) return ''
  return `<p class="text-base text-gray-300 leading-relaxed my-3">${inlineFormat(text.trim())}</p>`
}
