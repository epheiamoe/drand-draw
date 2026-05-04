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
  const h = hash.replace(/^#\/?\/?/, '')
  if (!h) return null
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

export function paramsToHash(params) {
  const usp = new URLSearchParams()
  usp.set('chain', params.chain)
  usp.set('deadline', String(params.deadline))
  usp.set('n', String(params.n))
  if (params.prizes && params.prizes.length) usp.set('prizes', params.prizes.join(','))
  if (params.winners && params.winners.length) usp.set('winners', params.winners.join(','))
  return '#/?' + usp.toString()
}
