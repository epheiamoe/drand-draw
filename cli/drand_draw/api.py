import json
import urllib.request

RELAYS = [
    'https://api.drand.sh',
    'https://api2.drand.sh',
    'https://drand.cloudflare.com',
]


def fetch_randomness(chain_hash, round_num):
    errors = []
    for relay in RELAYS:
        url = f'{relay}/{chain_hash}/public/{round_num}'
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data['randomness']
        except Exception as e:
            errors.append(f'{relay}: {e}')
            continue
    raise RuntimeError(
        f'Failed to fetch randomness for round {round_num} from all relays.\n'
        + '\n'.join(errors)
    )
