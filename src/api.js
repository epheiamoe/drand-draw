import { CHAINS } from './chains.js'

async function fetchWithFallback(urls, path) {
  for (const base of urls) {
    try {
      const res = await fetch(base + path, { signal: AbortSignal.timeout(8000) })
      if (res.ok) return await res.json()
    } catch {
      continue
    }
  }
  throw new Error('All relays failed for: ' + path)
}

export async function fetchBeacon(chainId, round) {
  const chain = CHAINS[chainId]
  if (!chain) throw new Error('Unknown chain: ' + chainId)
  const path = `/${chain.chainHash}/public/${round}`
  const data = await fetchWithFallback(chain.relays, path)
  return {
    round: data.round,
    randomness: data.randomness,
    signature: data.signature,
  }
}


