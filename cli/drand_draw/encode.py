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


import re

def _try_shortcode(val):
    """Direct short code."""
    try:
        return decode_short_code(val)
    except (ValueError, IndexError):
        return None


def _find_shortcode_in_text(val):
    """Find short code pattern in text."""
    m = re.search(r'\b[qde]-[0-9a-f]+-[0-9a-z]+(?:-[0-9a-z,]+)*\b', val)
    if m:
        try:
            return decode_short_code(m.group(0))
        except (ValueError, IndexError):
            pass
    return None


def _extract_url(val):
    """Extract URL and parse its hash/search params."""
    u = re.search(r'https?://[^\s]+', val)
    if u:
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(u.group(0))
            frag = parsed.fragment.lstrip('#')
            if frag.startswith('/?'):
                frag = frag[2:]
            if frag:
                qs = parse_qs(frag)
            else:
                qs = parse_qs(parsed.query)
            if 'chain' in qs and 'deadline' in qs and 'n' in qs:
                return {
                    'chain': qs['chain'][0],
                    'deadline': int(qs['deadline'][0]),
                    'n': int(qs['n'][0]),
                    'prizes': [int(x) for x in qs.get('prizes', [''])[0].split(',') if x] if 'prizes' in qs else [],
                    'winners': [int(x) for x in qs.get('winners', [''])[0].split(',') if x] if 'winners' in qs else [],
                }
        except Exception:
            pass
    return None


def _try_fragment(val):
    """Try to parse as hash/query fragment."""
    idx = max(val.rfind('#'), val.find('?'))
    if idx >= 0:
        frag = val[idx:]
        if frag.startswith('/?'):
            frag = frag[1:]
        if frag.startswith('?') or '=' in frag:
            from urllib.parse import parse_qs
            qs = parse_qs(frag.lstrip('?'))
            if 'chain' in qs and 'deadline' in qs and 'n' in qs:
                return {
                    'chain': qs['chain'][0],
                    'deadline': int(qs['deadline'][0]),
                    'n': int(qs['n'][0]),
                    'prizes': [int(x) for x in qs.get('prizes', [''])[0].split(',') if x] if 'prizes' in qs else [],
                    'winners': [int(x) for x in qs.get('winners', [''])[0].split(',') if x] if 'winners' in qs else [],
                }
    return None


def _try_raw(val):
    """Try raw key=value."""
    if '=' in val:
        from urllib.parse import parse_qs
        qs = parse_qs(val.lstrip('?'))
        if 'chain' in qs and 'deadline' in qs and 'n' in qs:
            return {
                'chain': qs['chain'][0],
                'deadline': int(qs['deadline'][0]),
                'n': int(qs['n'][0]),
                'prizes': [int(x) for x in qs.get('prizes', [''])[0].split(',') if x] if 'prizes' in qs else [],
                'winners': [int(x) for x in qs.get('winners', [''])[0].split(',') if x] if 'winners' in qs else [],
            }
    return None


def smart_parse(val):
    """Smart parse input text to extract draw parameters.

    Tries in order:
    1. Direct short code
    2. Short code in text
    3. URL extraction
    4. Hash/query fragment
    5. Raw key=value
    """
    if not val or not val.strip():
        return None
    val = val.strip()
    steps = [_try_shortcode, _find_shortcode_in_text, _extract_url, _try_fragment, _try_raw]
    for step in steps:
        result = step(val)
        if result is not None:
            return result
    return None
