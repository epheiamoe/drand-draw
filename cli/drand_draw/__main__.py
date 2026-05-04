import argparse
import sys
from datetime import datetime, timezone

from . import api
from . import encode
from . import lottery


def _fmt_tier(ti, count):
    return f'Prize Tier {ti + 1} ({count} winner{"s" if count > 1 else ""})'


def cmd_verify(args):
    chain = encode.CHAINS.get(args.chain)
    if not chain:
        print(f'Error: unknown chain "{args.chain}"', file=sys.stderr)
        sys.exit(1)

    try:
        randomness = api.fetch_randomness(chain['hash'], args.round)
    except RuntimeError as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)

    prize_tiers = [int(x) for x in args.prizes.split(',')]
    claimed = [int(x) for x in args.winners.split(',')]
    computed = lottery.compute_winners(randomness, args.n, prize_tiers)

    print(f'Round: #{args.round}')
    print(f'Randomness: {randomness}')

    all_ok = True
    idx = 0
    for ti, count in enumerate(prize_tiers):
        tier_computed = computed[idx:idx + count]
        tier_claimed = claimed[idx:idx + count]
        ok = tier_computed == tier_claimed
        if not ok:
            all_ok = False
        claimed_str = ', '.join(f'#{w}' for w in tier_claimed)
        marker = '\u2705' if ok else '\u274c'
        if ok:
            print(f'{_fmt_tier(ti, count)}: {claimed_str}  {marker}')
        else:
            computed_str = ', '.join(f'#{w}' for w in tier_computed)
            print(f'{_fmt_tier(ti, count)}: claimed {claimed_str}, computed {computed_str}  {marker}')
        idx += count

    print(f'Verification: {"PASSED" if all_ok else "FAILED"}')


def cmd_compute(args):
    chain = encode.CHAINS.get(args.chain)
    if not chain:
        print(f'Error: unknown chain "{args.chain}"', file=sys.stderr)
        sys.exit(1)

    round_num = lottery.compute_round(args.deadline, chain['genesis'], chain['period'])
    try:
        randomness = api.fetch_randomness(chain['hash'], round_num)
    except RuntimeError as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)

    prize_tiers = [int(x) for x in args.prizes.split(',')]
    winners = lottery.compute_winners(randomness, args.n, prize_tiers)

    deadline_dt = datetime.fromtimestamp(args.deadline, tz=timezone.utc)
    print(f'Deadline: {deadline_dt.strftime("%Y-%m-%d %H:%M:%S")} UTC')
    print(f'Round: #{round_num}')
    print(f'Randomness: {randomness}')

    idx = 0
    for ti, count in enumerate(prize_tiers):
        tier = winners[idx:idx + count]
        print(f'{_fmt_tier(ti, count)}: {", ".join(f"#{w}" for w in tier)}')
        idx += count


def cmd_encode(args):
    chain = encode.CHAINS.get(args.chain)
    if not chain:
        print(f'Error: unknown chain "{args.chain}"', file=sys.stderr)
        sys.exit(1)

    prizes = [int(x) for x in args.prizes.split(',')] if args.prizes else None
    winners = [int(x) for x in args.winners.split(',')] if args.winners else None
    print(encode.encode_short_code(args.chain, args.deadline, args.n, prizes, winners))


def cmd_decode(args):
    try:
        result = encode.decode_short_code(args.code)
    except ValueError as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)

    deadline_dt = datetime.fromtimestamp(result['deadline'], tz=timezone.utc)
    print(f'Chain: {result["chain"]}')
    print(f'Deadline: {result["deadline"]} ({deadline_dt.strftime("%Y-%m-%d %H:%M:%S")} UTC)')
    print(f'N: {result["n"]}')
    if result['prizes']:
        print(f'Prizes: {", ".join(str(p) for p in result["prizes"])}')
    if result['winners']:
        print(f'Winners: {", ".join(f"#{w}" for w in result["winners"])}')


def main():
    parser = argparse.ArgumentParser(
        description='drand-draw: Verifiable lottery CLI tool powered by drand'
    )
    sub = parser.add_subparsers(dest='command', required=True)

    p = sub.add_parser('verify', help='Verify claimed winners against drand randomness')
    p.add_argument('--chain', required=True, choices=list(encode.CHAINS))
    p.add_argument('--round', required=True, type=int)
    p.add_argument('--n', required=True, type=int)
    p.add_argument('--prizes', required=True)
    p.add_argument('--winners', required=True)
    p.set_defaults(func=cmd_verify)

    p = sub.add_parser('compute', help='Compute winners from deadline and N')
    p.add_argument('--chain', required=True, choices=list(encode.CHAINS))
    p.add_argument('--deadline', required=True, type=int)
    p.add_argument('--n', required=True, type=int)
    p.add_argument('--prizes', required=True)
    p.set_defaults(func=cmd_compute)

    p = sub.add_parser('encode', help='Encode parameters to short code')
    p.add_argument('--chain', required=True, choices=list(encode.CHAINS))
    p.add_argument('--deadline', required=True, type=int)
    p.add_argument('--n', required=True, type=int)
    p.add_argument('--prizes')
    p.add_argument('--winners')
    p.set_defaults(func=cmd_encode)

    p = sub.add_parser('decode', help='Decode short code to parameters')
    p.add_argument('code')
    p.set_defaults(func=cmd_decode)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
