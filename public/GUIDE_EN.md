# Verifiable Lottery — Social Media Giveaway Tool

> **This is not a blockchain project, not Web3, not NFT minting, not an enterprise RNG service.** It's a simple social media giveaway tool for X/Twitter creators. That's all.

**One sentence: Host sets a deadline → Fans participate → Draw uses drand randomness → Result is publicly verifiable.**

### What it does (scope is narrow)

- ✅ X/Twitter creators running comment/like giveaways
- ✅ Any social platform giveaway with a public participant list

### What it does NOT do (important)

- ❌ Not a smart contract, not on-chain
- ❌ Not an NFT mint / whitelist tool
- ❌ Not an enterprise randomness service
- ❌ Does not store any user data

---

## TL;DR (30 seconds)

### Host

```
① Fill params → ② Share link → ③ Deadline passes → ④ Open same link, click "Draw" → ⑤ Publish result
```

### Fan

```
Receive link → Open:
  • Before deadline: See countdown → wait
  • After deadline: Result auto-displays → page verifies for you ✅/❌
You can also close the link, enter parameters manually, and get the same result.
```

---

## Three Phases

---

### Phase 1: Announce the Draw (Host)

The host announces the lottery on social media with the draw link attached.

**Host steps:**

1. Open [drand-draw.pages.dev](https://drand-draw.pages.dev) → Click "Create Draw"
2. Select drand network (recommended: **QuickNet**, 3s/round)
3. Enter **N** (expected number of participants) and **deadline** (with timezone)
4. Configure **prizes** (default: 1 first prize, add more as needed)
5. Click "Generate Draw Link"

You get two things:

| Type | Example | Use |
|------|---------|-----|
| 🔗 **Link** | `drand-draw.pages.dev/#/?chain=quicknet&deadline=1715000000&n=100` | Share directly on social media |
| 🔢 **Short Code** | `q-66364280-2s-1` | Avoid link throttling on X/Twitter |

**Publish the link or short code publicly in your lottery post.**

> ⚠️ Important: The link **must** be published before the deadline. Posting after the deadline makes it impossible to verify the deadline wasn't altered.

**💡 Pro Tip: Use X comments + Grok for participant collection**

When running a lottery on X, ask users to **comment** (not like) to enter:

1. Comments are public and verifiable by anyone
2. **Grok** (X's built-in AI) can read comment data instantly
3. Just ask Grok: *"List all users who commented on this post"*
4. No manual screenshots, no scraping needed

Suggested post template:
```
🎉 Lottery rules:
• Comment on this post before the deadline to enter
• I'll use Grok to get the participant list after deadline
• Sorted alphabetically and numbered
• Winner determined by drand randomness (publicly verifiable)
• Anyone can independently verify

Verify: drand-draw.pages.dev
```

**When a fan opens the link before the deadline, they see:**
```
┌──────────────────────────────────┐
│  🔒 Draw Not Open Yet            │
│                                   │
│  Deadline: 2026-05-10 18:00 UTC  │
│  ⏳ Time remaining: 2d 03h 15m   │
│                                   │
│  Participants N: 100              │
│  Prizes: 1st Prize × 1            │
│  Expected drand Round #1234567   │
└──────────────────────────────────┘
```

---

### Phase 2: Publish Participant List (Host)

After the deadline, the host must:

1. **Collect** all valid participants (use Grok for X comments)
2. **Deduplicate**: same user = one entry
3. **Sort**: All @usernames in ASCII ascending order (digits → uppercase → lowercase)
4. **Number**: Starting from **0**
5. **Publish** the complete numbered list

> 💡 **Sorting tool**: On the "Create Draw" page, scroll down to the "Participant List Sorter". Paste handles (space/comma/newline separated), and it automatically sorts and numbers them. You can copy the sorted text or export as images. Choose "Single Column" or "Square Grid" mode — square mode minimizes image quality loss on X.

> ⚠️ If a participant finds themselves missing from the list, they should raise the issue now.

---

### Phase 3: Draw & Verify

#### Host: Perform the Draw

1. Open **the same link** you generated earlier
2. The page now shows "Awaiting draw" → click "Draw Now"
3. The page fetches randomness from drand and computes winners automatically
4. Share the result (link / short code / text) on social media

Result page shows:
```
┌──────────────────────────────────┐
│  ✅ Draw Complete                 │
│  Round: #1234567                  │
│  Randomness: 0xa3f25c8d1e...     │
│  🥇 1st Prize: #42               │
│                                   │
│  [Copy Link] [Copy Code] [Share]  │
└──────────────────────────────────┘
```

#### Fan: Verify (3 ways)

**Way 1: Click the link (easiest)**
Open the link → page auto-fetches drand → computes → shows ✅ or ❌

```
┌──────────────────────────────────┐
│  ✅ Verification Passed           │
│                                   │
│  From drand Round #1234567        │
│  Randomness: 0xa3f25c8d1e...     │
│  Calculation: (0xa3f2...%100)+1=42│
│  Matches claimed winner ✓         │
└──────────────────────────────────┘
```

**Way 2: Enter short code**
Open drand-draw.pages.dev → paste short code → auto-verifies

**Way 3: Manual input (no link needed)**
If the host only posted text, enter chain / round / N / claimed winner manually → verify

---

## Why This Is Trustless

### Attack Analysis

| What if the host tries to... | Can they? | Why? |
|---|---|---|
| Pick a favorable round after seeing randomness | ❌ No | Round is uniquely determined by deadline, locked in the link |
| Tell different people different N | ❌ No | N is locked in the link, everyone sees the same number |
| Use a different sorting order | ❌ No | Sorting rules are hardcoded in this page (ASCII ascending) |
| Redraw until satisfied | ❌ No | Same deadline produces exactly one result |
| Alter the participant list after deadline | ⚠️ Social | List was published in Phase 2, fans can verify |

### Technical Foundation

drand is a **decentralized randomness beacon** operated by 15+ independent organizations including Cloudflare, Protocol Labs, and Ethereum Foundation. No single entity can manipulate the output.

### Remaining Caveats (Social)

- Host must publish the link **before** the deadline
- Host must publish the full participant list before drawing
- Deduplication is the host's responsibility

---

## FAQ

### Q: What's the difference between a link and a short code?

Same data, different format. Links are clickable, short codes avoid X/Twitter link throttling.

### Q: Why QuickNet over Default?

QuickNet produces a round every 3 seconds; Default every 30 seconds. QuickNet means less waiting after deadline.

### Q: What if drand is unreachable?

The page automatically falls back to relay nodes (api2.drand.sh, drand.cloudflare.com). If all fail, it will prompt you to retry.

### Q: Can the result be known before the deadline?

No. The drand round is produced after the deadline, and its randomness is unpredictable until published.

### Q: What if two winners get the same number?

The algorithm automatically advances to the next unclaimed number. All prizes are computed independently.

### Q: Does this tool store any data?

No. Everything is in the link/code. This is a fully client-side application with no backend server.

---

## Algorithm Specification

> The following specification allows developers and security auditors to independently reproduce lottery results. Implement in any language (Python, JavaScript, Go, Rust, etc.).

---

### §1 Participant List Sorting & Numbering

```
Input:  Array of participant usernames (strings)
Output: Ordered list numbered 0 to N-1

Steps:
  1. Deduplicate: remove duplicate usernames
  2. Sort: ascending by ASCII code order
     Rule: "0" < "9" < "@" < "A" < "Z" < "_" < "a" < "z"
  3. Number: assign sequentially starting from 0
     N = total unique participants
```

---

### §2 Round Calculation

```
Chain       genesis_ts    period
quicknet    1692803367    3
default     1595431050    30
evmnet      1727521075    3

round = floor((deadline - genesis_ts) / period) + 1

Example (quicknet, deadline = 1715000000):
  elapsed = 1715000000 - 1692803367 = 22196633
  round   = floor(22196633 / 3) + 1 = 7398878
```

---

### §3 Fetch Randomness

```
GET https://api.drand.sh/{chain_hash}/public/{round}

Response:
{
  "round": 7398878,
  "randomness": "a3f25c8d1e7b...",  // 64-char hex string
  "signature": "92daf574..."
}

Recommended to fetch from multiple relays and cross-check:
- api.drand.sh
- api2.drand.sh
- drand.cloudflare.com
```

---

### §4 Winner Computation (Core Algorithm)

```
function computeWinners(randomness, N, prizeTiers):
  winners = []
  used = {}

  for i = 0 to len(prizeTiers) - 1:
    for j = 0 to prizeTiers[i] - 1:
      shift = len(winners)                // number of winners already assigned
      seedHex = randomness + toHex(shift) // randomness + shift in hex
      bigVal = BigInt('0x' + seedHex)
      idx = bigVal % N

      while idx in used:                  // collision handling
        idx = (idx + 1) % N              // advance to next available

      used.add(idx)
      winners.append(idx)

  return winners
```

Each prize position uses a different slice of the randomness: `randomness + shift`. Collisions advance to the next unclaimed number (circular).

---

### §5 Verify via Command Line

```bash
CHAIN_HASH="52db9ba70e0cc0f6eaf7803dd07447a1f5477735"
ROUND=7398878
N=100

RANDOMNESS=$(curl -s "https://api.drand.sh/${CHAIN_HASH}/public/${ROUND}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['randomness'])")

python3 -c "
r = '$RANDOMNESS'
N = $N
prizes = [1, 3]  # 1 first prize, 3 second prizes
winners = []
used = set()
for i, c in enumerate(prizes):
  for j in range(c):
    s = len(winners)
    idx = int(r + format(s, 'x'), 16) % N
    while idx in used:
      idx = (idx + 1) % N
    used.add(idx)
    winners.append(idx)
print('Winners:', winners)
"
```

---

### §6 Short Code Encoding

```
Format: {chain}-{deadline_hex}-{N_base36}-{prizes}-{winners}

Chain:  q=quicknet, d=default, e=evmnet

Examples:
  q-66364280-2s-1,3             ← config only, not yet drawn
  q-66364280-2s-1,3-2a,f,4e    ← drawn with winners
```

---

*Fully client-side · No data stored · Powered by drand*
