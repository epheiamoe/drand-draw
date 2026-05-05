import { CHAINS } from './chains.js'

export function computeRound(chainId, deadlineUnix) {
  const chain = CHAINS[chainId]
  const elapsed = deadlineUnix - chain.genesisTime
  if (elapsed < 0) return -1
  return Math.floor(elapsed / chain.period) + 1
}

async function deriveSeed(randomness, shift) {
  const input = randomness + ':' + shift
  const enc = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex
}

export async function computeWinners(randomness, n, prizeTiers) {
  const totalPrizes = prizeTiers.reduce((a, b) => a + b, 0)
  if (totalPrizes > n) {
    throw new Error(`Total prizes (${totalPrizes}) exceeds N (${n})`)
  }
  const winners = []
  const used = new Set()
  for (let i = 0; i < prizeTiers.length; i++) {
    for (let j = 0; j < prizeTiers[i]; j++) {
      const shift = winners.length
      const seedHex = await deriveSeed(randomness, shift)
      const bigVal = BigInt('0x' + seedHex)
      let idx = Number(bigVal % BigInt(n))
      let attempts = 0
      while (used.has(idx)) {
        idx = (idx + 1) % n
        attempts++
        if (attempts >= n) throw new Error('Collision resolution failed')
      }
      used.add(idx)
      winners.push(idx)
    }
  }
  return winners
}

export function formatWinnerList(winners, prizeTiers) {
  const result = []
  let idx = 0
  for (let i = 0; i < prizeTiers.length; i++) {
    const tierWinners = winners.slice(idx, idx + prizeTiers[i])
    result.push(tierWinners)
    idx += prizeTiers[i]
  }
  return result
}
