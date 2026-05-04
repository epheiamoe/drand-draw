# CLI 实现与跨语言一致性

drand-draw 的核心设计原则是 **一次抽奖，处处可验**。博主用网页版发起抽奖，粉丝可以用网页版验证，任何第三方也可以用 Python CLI 独立验证——前提是两套代码的算法完全一致。本文打开 Python CLI 的黑箱，对照 JavaScript 前端，逐模块验证一致性。

## 模块映射

JavaScript 前端（`src/`）与 Python CLI（`cli/drand_draw/`）采用相同的功能拆分方式，三组文件一一对应：

| 职责 | JavaScript | Python | 核心函数/导出 |
|------|-----------|--------|--------------|
| 抽奖算法 | `src/lottery.js` | `cli/drand_draw/lottery.py` | `computeRound` / `compute_round`、`computeWinners` / `compute_winners` |
| 短码编解码 | `src/encode.js` | `cli/drand_draw/encode.py` | `encodeShortCode` / `encode_short_code`、`decodeShortCode` / `decode_short_code` |
| drand API 调用 | `src/api.js` | `cli/drand_draw/api.py` | `fetchBeacon` / `fetch_randomness` |
| 链配置 | `src/chains.js` | `cli/drand_draw/encode.py` 内嵌 | `CHAINS` 常量 |

链配置在 Python 端没有独立文件，直接定义在 `encode.py` 的模块级字典 `CHAINS` 中。[来源](src/chains.js#L1-L47) [来源](cli/drand_draw/encode.py#L1-L26)

---

## 验证一：computeRound 公式

两端的公式完全一致：`floor((deadline - genesis) / period) + 1`。

```python
# lottery.py
def compute_round(deadline, genesis, period):
    elapsed = deadline - genesis
    if elapsed < 0:
        return -1
    return math.floor(elapsed / period) + 1
```
[来源](cli/drand_draw/lottery.py#L3-L8)

```javascript
// lottery.js
export function computeRound(chainId, deadlineUnix) {
  const chain = CHAINS[chainId]
  const elapsed = deadlineUnix - chain.genesisTime
  if (elapsed < 0) return -1
  return Math.floor(elapsed / chain.period) + 1
}
```
[来源](src/lottery.js#L1-L7)

唯一区别是签名：Python 版本接受三个独立参数 `(deadline, genesis, period)`，JavaScript 版本接受链 ID 然后从 `CHAINS` 中读取。调用层封装了这种差异——Python CLI 的 `cmd_compute` 从 `encode.CHAINS` 中取出 genesis 和 period 再传给 `compute_round`。[来源](cli/drand_draw/__main__.py#L50-L52)

---

## 验证二：computeWinners 算法

这是整个系统最关键的算法。两端实现了完全相同的逻辑链：**randomness + shift 拼接 → 大整数取模 → 碰撞顺延**。

验证要点：

| 步骤 | 预期行为 | Python 实现 | JavaScript 实现 |
|------|---------|------------|----------------|
| 1. 检查奖品总数 | `sum(prizes) > N` 时抛错 | `if total > n: raise ValueError(...)` | `if (totalPrizes > n) throw new Error(...)` |
| 2. 构造 seed | `randomness + format(shift, 'x')` | `seed_hex = randomness + format(shift, 'x')` | `const seedHex = randomness + shift.toString(16)` |
| 3. 取模 | 大整数对 N 取模 | `int(seed_hex, 16) % n` | `Number(BigInt('0x' + seedHex) % BigInt(n))` |
| 4. 碰撞顺延 | `(idx + 1) % N` 环形查找 | `idx = (idx + 1) % n` | `idx = (idx + 1) % n` |
| 5. 上限保护 | 尝试 N 次后抛错 | `if attempts >= n: raise RuntimeError(...)` | `if (attempts >= n) throw new Error(...)` |

JavaScript 使用 `BigInt` 处理任意长度的十六进制字符串，Python 的 `int(seed_hex, 16)` 原生支持大整数，两种语言在此处能力等价。[来源](cli/drand_draw/lottery.py#L10-L31) [来源](src/lottery.js#L9-L32)

**shift 的含义**：shift 是当前已确定的中奖数量。第 1 个奖位的 shift=0，第 2 个 shift=1，以此类推。这意味着每个奖位的 seed 都不同，即使 randomness 被公开，也无法用同一个 randomness 推导出所有奖位。[来源](src/lottery.js#L21-L22) [来源](cli/drand_draw/lottery.py#L21-L22)

---

## 验证三：短码编解码

短码格式是 `{chain}-{deadline_hex}-{N_base36}-{prizes}-{winners}`，两端的编解码规则完全一致。

| 字段 | 编码方式 | Python | JavaScript |
|------|---------|--------|-----------|
| chain 前缀 | 字母映射 | `CHAINS[chain_name]['prefix']` | `SHORT_CHAIN[chain]` |
| deadline | 十六进制小端 | `format(deadline, 'x')` | `params.deadline.toString(16)` |
| N | base36 | 自定义 `to_base36` | `params.n.toString(36)` |
| prizes | base36 逗号分隔 | `','.join(to_base36(p) for p in prizes)` | `params.prizes.map(p => p.toString(36)).join(',')` |

Python 的 `to_base36` / `from_base36` 是自定义实现，通过反复除 36 取余构建 base36 字符串。[来源](cli/drand_draw/encode.py#L28-L46) JavaScript 直接使用 `Number.toString(36)` 和 `parseInt(s, 36)`，两者结果一致。[来源](src/encode.js#L1-L20)

链前缀映射表确认一致：

| 链 | 前缀 | Python | JavaScript |
|----|------|--------|-----------|
| quicknet | q | `'prefix': 'q'` | `SHORT_CHAIN: { quicknet: 'q' }` |
| default | d | `'prefix': 'd'` | `SHORT_CHAIN: { default: 'd' }` |
| evmnet | e | `'prefix': 'e'` | `SHORT_CHAIN: { evmnet: 'e' }` |

[来源](cli/drand_draw/encode.py#L4-L17) [来源](src/chains.js#L55-L56)

---

## 验证四：链配置数据

三条链的 genesis、period、chain hash 是算法输入的上游数据，必须严格一致。

| 参数 | 链 | Python | JavaScript |
|------|----|--------|-----------|
| genesis | quicknet | `1692803367` | `1692803367` |
| period | quicknet | `3` | `3` |
| hash | quicknet | `52db9ba7...c84e971` | `52db9ba7...c84e971` |
| genesis | default | `1595431050` | `1595431050` |
| period | default | `30` | `30` |
| hash | default | `8990e7a9...51b2ce` | `8990e7a9...51b2ce` |
| genesis | evmnet | `1727521075` | `1727521075` |
| period | evmnet | `3` | `3` |
| hash | evmnet | `04f1e906...66ec8c3` | `04f1e906...66ec8c3` |

六组核心参数完全一致。JavaScript 版额外包含 `publicKey`、`scheme`、`relays` 等字段，但 Python 版只使用了必要的 genesis、period、hash 和 prefix。[来源](cli/drand_draw/encode.py#L4-L17) [来源](src/chains.js#L1-L56)

---

## 交叉验证脚本

以下脚本使用同一组输入数据分别在 Python CLI 和浏览器控制台中运行，验证两者输出一致：

```bash
#!/usr/bin/env bash
# cross_validate.sh — 交叉验证 CLI 与网页版算法一致性
set -e

CHAIN=quicknet
DEADLINE=1715000000
N=100
PRIZES="1,3"

echo "=== 步骤 1: 用 Python CLI compute 计算 ==="
python -m drand_draw compute \
  --chain "$CHAIN" --deadline "$DEADLINE" --n "$N" --prizes "$PRIZES" 2>/dev/null

echo ""
echo "=== 步骤 2: 提取 round 和 randomness ==="
ROUND=$(
  python -c "
import math
genesis=1692803367
period=3
elapsed=$DEADLINE - genesis
rnd = math.floor(elapsed / period) + 1
print(rnd)
"
)
echo "Round: $ROUND"

echo ""
echo "=== 步骤 3: 用 Python 独立计算 winners（不依赖 CLI）==="
python -c "
import urllib.request, json

# 获取 randomness
url = f'https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/$ROUND'
resp = urllib.request.urlopen(url)
data = json.loads(resp.read())
randomness = data['randomness']
print(f'Randomness: {randomness}')

# 计算 winners
n = $N
prizes = [1, 3]
winners = []
used = set()
for count in prizes:
    for _ in range(count):
        shift = len(winners)
        seed_hex = randomness + format(shift, 'x')
        idx = int(seed_hex, 16) % n
        while idx in used:
            idx = (idx + 1) % n
        used.add(idx)
        winners.append(idx)
print(f'Winners: {winners}')
"
```

将此脚本的输出与在浏览器控制台运行以下 JavaScript 的结果比对：

```javascript
// 在浏览器控制台运行，需确保已在页面加载 lottery.js
const CHAIN = 'quicknet';
const DEADLINE = 1715000000;
const N = 100;
const PRIZES = [1, 3];

const round = computeRound(CHAIN, DEADLINE);
console.log('Round:', round);

// 获取 randomness 后
const randomness = '...';  // 从 drand API 获取的 64 字符十六进制
const winners = computeWinners(randomness, N, PRIZES);
console.log('Winners:', winners);
```

两者输出的 winners 数组必须逐位相同。如有差异，说明算法实现或输入数据不一致。[来源](cli/drand_draw/lottery.py#L10-L31) [来源](src/lottery.js#L9-L32)

---

## 安全保证：一致性意味着什么

跨语言一致性不是代码洁癖，而是安全模型的核心支柱。如果 Python CLI 和 JavaScript 前端对同一组输入产生不同输出，系统就失去了 **可独立验证** 的承诺。

具体来说，一致性保证了：

1. **博主无法否认**：用网页版发起的抽奖，Python CLI 必须能重现同一结果。
2. **粉丝不依赖前端**：粉丝可以完全不用网页版，只用 `pip install` 安装 CLI 后独立验证。
3. **任何第三方可介入**：任何第三方开发者都可以参照 [`ALGORITHM.md`](算法规范独立文档.md) 用自己熟悉的语言复现抽奖逻辑，并用 Python CLI 的输出来交叉校验。

详细讨论信任模型的建立方式，请参见[抽奖的安全模型](抽奖的安全模型.md)。

---

## 边界差异

两端的实现并非机械复制，有几处合理的边界差异：

| 差异点 | Python | JavaScript | 原因 |
|--------|--------|-----------|------|
| API 调用 | `urllib.request` 同步阻塞 | `fetch` + `AbortSignal.timeout` 异步 | CLI 不需要并发，同步代码更简洁 |
| 超时 | `urllib.request.urlopen(..., timeout=10)` | `AbortSignal.timeout(8000)` | 值不同但不影响正确性 |
| 链查询 | 直接使用 relay 列表硬编码 | 通过 `chain.relays` 读取 | Python 版简化，只保留最基本的三组 |
| base36 | 自实现除 36 取余 | `Number.toString(36)` | Python 无内置 base36，自实现保证与 JS 一致 |

这些差异不影响算法输出，只影响执行环境和开发者体验。[来源](cli/drand_draw/api.py#L1-L20) [来源](src/api.js#L1-L18)

---

## 下一步

- 阅读[核心抽奖算法详解](核心抽奖算法详解.md)了解 computeRound 和 computeWinners 的数学原理
- 阅读[短码设计与编解码](短码设计与编解码.md)了解短码格式的更多设计细节
- 如果需要用其他语言复现算法，请参考[算法规范独立文档](算法规范独立文档.md)