import math


def compute_round(deadline, genesis, period):
    elapsed = deadline - genesis
    if elapsed < 0:
        return -1
    return math.floor(elapsed / period) + 1


def compute_winners(randomness, n, prize_tiers):
    total = sum(prize_tiers)
    if total > n:
        raise ValueError(f"Total prizes ({total}) exceeds N ({n})")
    winners = []
    used = set()
    for count in prize_tiers:
        for _ in range(count):
            shift = len(winners)
            seed_hex = randomness + format(shift, 'x')
            big_val = int(seed_hex, 16)
            idx = big_val % n
            attempts = 0
            while idx in used:
                idx = (idx + 1) % n
                attempts += 1
                if attempts >= n:
                    raise RuntimeError("Collision resolution failed")
            used.add(idx)
            winners.append(idx)
    return winners
