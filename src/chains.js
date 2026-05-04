export const CHAINS = {
  quicknet: {
    id: 'quicknet',
    chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
    publicKey: '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
    period: 3,
    genesisTime: 1692803367,
    scheme: 'bls-unchained-g1-rfc9380',
    relays: [
      'https://api.drand.sh',
      'https://api2.drand.sh',
      'https://drand.cloudflare.com',
    ],
  },
  default: {
    id: 'default',
    chainHash: '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce',
    publicKey: '868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31',
    period: 30,
    genesisTime: 1595431050,
    scheme: 'pedersen-bls-chained',
    relays: [
      'https://api.drand.sh',
      'https://api2.drand.sh',
      'https://drand.cloudflare.com',
    ],
  },
  evmnet: {
    id: 'evmnet',
    chainHash: '04f1e9062b8a81f848fded9c12306733282b2727ecced50032187751166ec8c3',
    publicKey: '07e1d1d335df83fa98462005690372c643340060d205306a9aa8106b6bd0b3820557ec32c2ad488e4d4f6008f89a346f18492092ccc0d594610de2732c8b808f0095685ae3a85ba243747b1b2f426049010f6b73a0cf1d389351d5aaaa1047f6297d3a4f9749b33eb2d904c9d9ebf17224150ddd7abd7567a9bec6c74480ee0b',
    period: 3,
    genesisTime: 1727521075,
    scheme: 'bls-bn254-unchained-on-g1',
    relays: [
      'https://api.drand.sh',
      'https://api2.drand.sh',
      'https://drand.cloudflare.com',
    ],
  },
}

export const CHAIN_LIST = ['quicknet', 'default', 'evmnet']

export const CHAIN_SHORT = { q: 'quicknet', d: 'default', e: 'evmnet' }
export const SHORT_CHAIN = { quicknet: 'q', default: 'd', evmnet: 'e' }
