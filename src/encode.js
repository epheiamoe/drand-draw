import { CHAIN_SHORT, SHORT_CHAIN } from './chains.js'

export function encodeShortCode(params) {
  const parts = [SHORT_CHAIN[params.chain] || 'q']
  parts.push(params.deadline.toString(16))
  parts.push(params.n.toString(36))
  if (params.prizes && params.prizes.length) {
    parts.push(params.prizes.map(p => p.toString(36)).join(','))
  }
  if (params.winners && params.winners.length) {
    parts.push(params.winners.map(w => w.toString(36)).join(','))
  }
  return parts.join('-')
}

export function decodeShortCode(code) {
  const parts = code.split('-')
  if (parts.length < 3) return null
  const chainId = CHAIN_SHORT[parts[0]] || 'quicknet'
  const deadline = parseInt(parts[1], 16)
  if (isNaN(deadline)) return null
  const n = parseInt(parts[2], 36)
  if (isNaN(n)) return null
  const result = { chain: chainId, deadline, n, prizes: [], winners: [] }
  if (parts[3]) {
    result.prizes = parts[3].split(',').map(x => parseInt(x, 36)).filter(x => !isNaN(x))
  }
  if (parts[4]) {
    result.winners = parts[4].split(',').map(x => parseInt(x, 36)).filter(x => !isNaN(x))
  }
  return result
}

export function paramsToShortCode(params) {
  return encodeShortCode(params)
}

export function shortCodeToParams(code) {
  return decodeShortCode(code)
}

export function hashToParams(hash) {
  if (!hash) return null
  let h = hash.replace(/^#\/?\/?/, '')
  if (!h) return null
  h = h.replace(/^\/\?/, '')
  if (h.startsWith('?') || h.includes('=')) {
    const search = h.startsWith('?') ? h : '?' + h
    const usp = new URLSearchParams(search)
    const params = {}
    for (const [k, v] of usp) params[k] = v
    if (params.chain && params.deadline && params.n) {
      const decoded = {
        chain: params.chain,
        deadline: parseInt(params.deadline),
        n: parseInt(params.n),
        prizes: params.prizes ? params.prizes.split(',').map(x => parseInt(x)).filter(x => !isNaN(x)) : [],
        winners: params.winners ? params.winners.split(',').map(x => parseInt(x)).filter(x => !isNaN(x)) : [],
      }
      if (!isNaN(decoded.deadline) && !isNaN(decoded.n)) return decoded
    }
    return null
  }
  if (h.startsWith('verify/')) {
    const code = h.slice(7)
    return decodeShortCode(code)
  }
  const decoded = decodeShortCode(h)
  if (decoded) return decoded
  return null
}

export function smartParse(val) {
  if (!val) return null
  // 1. Direct short code (must look like one)
  if (/^[qde]-[0-9a-f]+-/.test(val)) {
    const d = decodeShortCode(val)
    if (d) return d
  }
  // 2. Find short code in text
  const m = val.match(/\b[qde]-[0-9a-f]+-[0-9a-z]+(?:-[0-9a-z,]+)*\b/)
  if (m) {
    const d = decodeShortCode(m[0])
    if (d) return d
  }
  // 3. Extract URL, parse its hash or search
  const u = val.match(/https?:\/\/[^\s]+/)
  if (u) {
    try {
      const url = new URL(u[0])
      const frag = url.hash.replace(/^#/, '')
      const p = hashToParams(frag || url.search.slice(1))
      if (p) return p
    } catch { /* invalid URL */ }
  }
  // 4. Try as hash/query fragment
  const qIdx = Math.max(val.lastIndexOf('#'), val.indexOf('?'))
  if (qIdx >= 0) {
    const p = hashToParams(val.slice(qIdx))
    if (p) return p
  }
  // 5. Raw key=value
  if (val.includes('=')) {
    const p = hashToParams(val)
    if (p) return p
  }
  return null
}

export function paramsToHash(params) {
  const usp = new URLSearchParams()
  usp.set('chain', params.chain)
  usp.set('deadline', String(params.deadline))
  usp.set('n', String(params.n))
  if (params.prizes && params.prizes.length) usp.set('prizes', params.prizes.join(','))
  if (params.winners && params.winners.length) usp.set('winners', params.winners.join(','))
  return '#/?' + usp.toString()
}
