CHAINS = {
    'quicknet': {
        'prefix': 'q',
        'genesis': 1692803367,
        'period': 3,
        'hash': '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
    },
    'default': {
        'prefix': 'd',
        'genesis': 1595431050,
        'period': 30,
        'hash': '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce',
    },
    'evmnet': {
        'prefix': 'e',
        'genesis': 1727521075,
        'period': 3,
        'hash': '04f1e9062b8a81f848fded9c12306733282b2727ecced50032187751166ec8c3',
    },
}

PREFIX_TO_CHAIN = {v['prefix']: k for k, v in CHAINS.items()}

_BASE36_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'


def to_base36(n):
    if n == 0:
        return '0'
    result = []
    while n > 0:
        result.append(_BASE36_CHARS[n % 36])
        n //= 36
    return ''.join(reversed(result))


def from_base36(s):
    return int(s, 36)


def encode_short_code(chain_name, deadline, n, prizes=None, winners=None):
    prefix = CHAINS[chain_name]['prefix']
    deadline_hex = format(deadline, 'x')
    n_b36 = to_base36(n)
    parts = [prefix, deadline_hex, n_b36]
    if prizes:
        parts.append(','.join(to_base36(p) for p in prizes))
        if winners:
            parts.append(','.join(to_base36(w) for w in winners))
    return '-'.join(parts)


def decode_short_code(code):
    parts = code.split('-')
    if len(parts) < 3:
        raise ValueError('Invalid short code: need at least 3 parts')

    prefix = parts[0]
    if prefix not in PREFIX_TO_CHAIN:
        raise ValueError(f'Unknown chain prefix: {prefix}')

    chain_name = PREFIX_TO_CHAIN[prefix]
    deadline = int(parts[1], 16)
    n = from_base36(parts[2])
    prizes = None
    winners = None

    if len(parts) >= 4 and parts[3]:
        prizes = [from_base36(x) for x in parts[3].split(',')]
    if len(parts) >= 5 and parts[4]:
        winners = [from_base36(x) for x in parts[4].split(',')]

    return {
        'chain': chain_name,
        'deadline': deadline,
        'n': n,
        'prizes': prizes or [],
        'winners': winners or [],
    }
