# drand HTTP API 集成

drand 网络通过 **HTTP API** 对外提供公开随机数，应用层只需向任意一个 **Relay 节点** 发送 GET 请求即可获取指定轮次的 **beacon**（随机信标）。本项目在 JavaScript 和 Python 两端分别实现了对这套 API 的封装，核心逻辑完全一致：**多 Relay 容错 + 超时控制 + 调用方重试**。

---

## 三层封装架构

整个集成分为三个层次，职责逐层递进：

| 层级 | 文件 | 职责 |
|------|------|------|
| **链配置** | `src/chains.js` | 定义三条 drand 链的元信息（chainHash、publicKey、period、relays 等） |
| **HTTP 传输** | `src/api.js` / `cli/drand_draw/api.py` | 发送 HTTP 请求，按序尝试多个 Relay，解析 JSON 响应 |
| **业务重试** | `src/components/DrawStatus.js` | 在传输层之上叠加重试逻辑，应对临时网络抖动 |

[来源](src/api.js#L1-L22) | [来源](src/chains.js#L1-L47) | [来源](src/components/DrawStatus.js#L8-L16)

---

## 三条链与三个 Relay

### 链标识

项目支持三条 drand 链，短码映射为 `q` / `d` / `e`：

| 链 ID | 短码 | 间隔 | 用途 |
|-------|------|------|------|
| `quicknet` | `q` | 3 秒 | 默认链，低延迟 |
| `default` | `d` | 30 秒 | 主网经典链 |
| `evmnet` | `e` | 3 秒 | 以太坊兼容链 |

[来源](src/chains.js#L3-L47)

### Relay 地址

三条链共享同一组 Relay 地址，硬编码于两个位置：

```javascript
// src/chains.js — 每条链的 relays 字段
relays: [
  'https://api.drand.sh',
  'https://api2.drand.sh',
  'https://drand.cloudflare.com',
]
```

```python
# cli/drand_draw/api.py — 全局常量
RELAYS = [
    'https://api.drand.sh',
    'https://api2.drand.sh',
    'https://drand.cloudflare.com',
]
```

选择这三个 Relay 的原因：`api.drand.sh` 是 **drand 官方** 主节点，`api2.drand.sh` 是官方备用节点，`drand.cloudflare.com` 由 **Cloudflare** 托管，三者来自不同运营方，任意一个宕机不影响可用性。

[来源](src/chains.js#L14-L18) | [来源](cli/drand_draw/api.py#L4-L8)

---

## fetchWithFallback：多 Relay 容错

### JavaScript 实现

```javascript
async function fetchWithFallback(urls, path) {
  for (const base of urls) {                  // ① 按序遍历三个 Relay
    try {
      const res = await fetch(base + path, {
        signal: AbortSignal.timeout(8000)      // ② 每个 Relay 8 秒超时
      })
      if (res.ok) return await res.json()      // ③ 首个成功的直接返回
    } catch {
      continue                                 // ④ 失败则静默尝试下一个
    }
  }
  throw new Error('All relays failed for: ' + path)
}
```

**核心设计**：三个 Relay **顺序尝试**而非并行——并行虽能减延迟，但会增加客户端流量和服务器负载。当首个 Relay 返回正常时，其余两个根本不会被调用。

**超时设定**：`AbortSignal.timeout(8000)` 是 Web 标准 API，8 秒后自动中止请求。如果某个 Relay 响应缓慢（而非宕机），不会卡住整个流程超过 8 秒。

[来源](src/api.js#L3-L12)

### Python 实现

```python
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
    raise RuntimeError(...)
```

Python 版同样按序遍历，差异在于超时设为 **10 秒**（而非 8 秒），且返回时直接提取 `randomness` 字段，不返回整个 beacon 对象。这是因为 CLI 工具只关心随机数本身，不关心 `round` 和 `signature` 的验证。

[来源](cli/drand_draw/api.py#L10-L24)

---

## 业务重试：应对临时网络抖动

`src/api.js` 的 `fetchWithFallback` 只负责**单次尝试所有 Relay**。但如果三个 Relay 都因网络波动暂时不可达，单次尝试就会全部失败。为此，`DrawStatus.js` 在调用层叠加了**重试机制**。

### fetchWithRetry（通用重试）

```javascript
async function fetchWithRetry(chain, round, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchBeacon(chain, round)    // 调用 api.js
    } catch {
      if (attempt >= maxRetries - 1) throw      // 最后一步不再等待，直接抛错
      await new Promise(r => setTimeout(r, 2000)) // 间隔 2 秒
    }
  }
}
```

对 `fetchBeacon`（它内部调用 `fetchWithFallback`）最多重试 **5 次**，每次间隔 **2 秒**。因此极端情况下，最长的等待时间约为：`(5次尝试 × 8秒超时) + (4次等待 × 2秒) = 48秒`。

[来源](src/components/DrawStatus.js#L8-L16)

### 抽奖发起专用重试（间隔 3 秒）

在抽奖发起的代码路径中（`renderDrawStatus` 内的 "do-draw" 流程），重试间隔为 **3 秒**而非 2 秒，但同样是 5 次上限：

```javascript
while (attempts < 5) {
  try {
    beacon = await fetchBeacon(params.chain, round)
    break
  } catch {
    attempts++
    if (attempts >= 5) throw new Error('Failed to fetch after retries')
    await new Promise(r => setTimeout(r, 3000))
  }
}
```

这一路径之所以使用更长的间隔（3 秒），是因为抽奖发起是**关键用户操作**——用户正在等待结果展示，更长的间隔给网络恢复留出更多时间，减少最终失败的概率。

[来源](src/components/DrawStatus.js#L161-L171)

---

## 响应数据结构

drand HTTP API 返回的 JSON 对象包含三个核心字段，也是前端 `fetchBeacon` 提取并返回的全部内容：

```json
{
  "round": 12345,
  "randomness": "d3a4f9c1b2e5...",
  "signature": "8a7b6c5d4e3f..."
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `round` | 整数 | 轮次号，从创世块开始递增 |
| `randomness` | 十六进制字符串 | 该轮次的随机数，用作抽奖算法的熵源 |
| `signature` | 十六进制字符串 | BLS 签名，可用公钥验证 randomness 的合法性 |

`fetchBeacon` 函数严格透传这三个字段，不做任何转换：

```javascript
export async function fetchBeacon(chainId, round) {
  const chain = CHAINS[chainId]
  const path = `/${chain.chainHash}/public/${round}`
  const data = await fetchWithFallback(chain.relays, path)
  return {
    round: data.round,
    randomness: data.randomness,
    signature: data.signature,
  }
}
```

[来源](src/api.js#L14-L22)

---

## 请求路径格式

拼接规则为：`/{chainHash}/public/{round}`

- `chainHash`：从 `src/chains.js` 中读取，每条链拥有唯一的哈希值
- `round`：由抽奖算法根据截止时间计算得出，详见 [核心抽奖算法详解](核心抽奖算法详解.md)

示例路径：

| 链 | round | 完整路径 |
|----|-------|----------|
| quicknet | 1 | `/52db9ba7.../public/1` |
| default | 1000 | `/8990e7a9.../public/1000` |

[来源](src/api.js#L17) | [来源](src/chains.js#L4)

---

## 用 curl 手动验证

你可以直接用 curl 向任意 Relay 发送请求，返回的 JSON 与 `fetchBeacon` 的返回值一致：

### 1. 获取已过去的指定轮次

```bash
curl -s https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/1
```

返回示例（格式化后）：

```json
{
  "round": 1,
  "randomness": "b9b3c75dba0d45e383c18d830fc08d5edd023cde76f9824b626cec846a3a3408",
  "signature": "a1b2c3d4..."
}
```

### 2. 获取最新轮次（latest）

将 `{round}` 替换为 `latest` 即可获取当前最新 beacon：

```bash
curl -s https://drand.cloudflare.com/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/latest
```

### 3. 验证超时与容错

分别对三个 Relay 发送请求，观察它们是否返回相同的结果：

```bash
# 三个 Relay 应返回相同的 randomness
curl -s https://api.drand.sh/52db9ba7.../public/latest | jq .randomness
curl -s https://api2.drand.sh/52db9ba7.../public/latest | jq .randomness
curl -s https://drand.cloudflare.com/52db9ba7.../public/latest | jq .randomness
```

> **注意**：`jq` 为可选工具，用于提取 JSON 字段；若未安装，直接查看完整 JSON 输出即可。

---

## 跨语言一致性要点

| 维度 | JavaScript (`src/api.js`) | Python (`cli/drand_draw/api.py`) |
|------|--------------------------|----------------------------------|
| Relay 列表 | 来自 `chains.js` 每链的 `relays` | 全局 `RELAYS` 常量 |
| 请求路径 | `/${chainHash}/public/${round}` | `/{chain_hash}/public/{round_num}` |
| 超时 | 8 秒（`AbortSignal.timeout`） | 10 秒（`urllib.request.urlopen` 的 `timeout` 参数） |
| 重试 | 由调用方 `DrawStatus.js` 提供 | 无内建重试，CLI 调用者自行处理 |
| 返回内容 | `{ round, randomness, signature }` | 只返回 `randomness` 字符串 |

[来源](src/api.js#L3-L22) | [来源](cli/drand_draw/api.py#L10-L24)

---

## 设计决策总结

1. **顺序 Fallback 而非并行**：减少不必要的网络请求，避免在 Relay 全部正常时浪费流量。
2. **超时而非无限等待**：8 秒（JS）/ 10 秒（Python）是合理的阈值，短于 drand 链的绝大多数出块间隔（quicknet 为 3 秒，经多轮确认后通常几秒可获取）。
3. **重试在业务层而非传输层**：`api.js` 只做纯传输，让 `DrawStatus.js` 根据场景决定重试次数和间隔（发起抽奖用 3 秒间隔，验证用 2 秒间隔），职责分离更清晰。

---

## 下一步

- 理解 drand 的密码学原理：[理解 drand 去中心化随机数](理解-drand-去中心化随机数.md)
- 查看 randomness 如何用于抽奖计算：[核心抽奖算法详解](核心抽奖算法详解.md)
- 了解 Python CLI 如何使用 API：[CLI 实现与跨语言一致性](cli-实现与跨语言一致性.md)
- 了解安全性边界：[抽奖的安全模型](抽奖的安全模型.md)