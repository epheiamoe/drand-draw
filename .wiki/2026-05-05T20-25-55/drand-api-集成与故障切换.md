# drand API 集成与故障切换

## 核心设计：fetchWithFallback

前端与 CLI 共享相同的 API 集成策略：**遍历优先级的 relay 列表，逐个尝试，任意成功即返回**。这一模式体现在两个独立的实现中，前端为 `src/api.js` 中的 `fetchWithFallback`，CLI 为 `cli/drand_draw/api.py` 中的 `fetch_randomness`。

前端的 `fetchWithFallback` 接受两个参数：`urls`（relay 基址数组）和 `path`（API 路径）。它对每个 relay 发起 `fetch`，使用 `AbortSignal.timeout(8000)` 设置 8 秒超时，检查 `res.ok` 确认 HTTP 状态，成功则解析 JSON 返回；失败则 `continue` 进入下一个 relay。所有 relay 均失败后抛出 `Error('All relays failed for: ' + path)`。[来源](src/api.js#L3-L8)

CLI 的 `fetch_randomness` 逻辑相同，但使用 Python 标准库 `urllib.request`，超时设为 10 秒。遍历 `RELAYS` 列表，对每个 relay 构造完整 URL 并发起请求，成功则从 JSON 中提取 `randomness` 字段返回；失败则收集错误信息，全部失败后抛 `RuntimeError`。[来源](cli/drand_draw/api.py#L7-L24)

两种实现的核心差异：

| 维度 | 前端 (api.js) | CLI (api.py) |
|------|-------------|-------------|
| HTTP 库 | `fetch` (浏览器原生) | `urllib.request` (标准库) |
| 超时 | 8 秒 (`AbortSignal.timeout`) | 10 秒 (`timeout=10`) |
| 返回内容 | `{ round, randomness, signature }` 对象 | 仅返回 `randomness` 字符串 |
| 异常处理 | 静默 `catch → continue` | `except Exception → continue` |

## 三条 Relay 链的故障切换

三条 relay 基址定义在 `src/chains.js` 和 `cli/drand_draw/api.py` 中，对所有 drand 链（QuickNet、Default、EVMNet）**完全相同**：

```
https://api.drand.sh
https://api2.drand.sh
https://drand.cloudflare.com
```

[来源](src/chains.js#L9-L12) | [来源](cli/drand_draw/api.py#L3-L6)

故障切换的优先级由数组顺序决定：`api.drand.sh` 为首选，`api2.drand.sh` 为第一备用，`drand.cloudflare.com` 为最终兜底。`fetchWithFallback` 按序遍历，前一个失败则下沉到下一个。**无需配置、无需健康检查、无需手动切换**，这种简单到极致的策略在代码量和可靠性之间取得了平衡——drand relay 的去中心化特性保证了至少有一个 relay 可用。

前端在 `fetchWithFallback` 之外，`DrawStatus.js` 还封装了 `fetchWithRetry`（对同一 chain/round 最多重试 5 次，间隔 2 秒），用于验证场景下应对 relay 临时抖动。[来源](src/components/DrawStatus.js#L7-L13)

## v1 API 端点格式

两类实现使用的端点格式完全一致：

```
/{chainHash}/public/{round}
```

其中 `chainHash` 是 64 字符十六进制字符串，标识具体的 drand 链；`round` 是正整数，标识信标轮次。前端通过 `fetchBeacon` 构建路径：

```js
const path = `/${chain.chainHash}/public/${round}`
const data = await fetchWithFallback(chain.relays, path)
```

[来源](src/api.js#L17-L19)

CLI 的构建方式相同：

```python
url = f'{relay}/{chain_hash}/public/{round_num}'
```

[来源](cli/drand_draw/api.py#L15)

完整请求示例：`https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/7398878`

## v1 与 v2 API 的差异

drand 信标网络提供两种 HTTP API 版本，核心区别在于响应结构：

| 差异 | v1 API | v2 API |
|------|--------|--------|
| 端点 | `/{chainHash}/public/{round}` | `/{chainHash}/public/{round}` (同路径，不同响应) |
| `randomness` 字段 | 直接返回 64 字符十六进制 | **不返回** |
| `signature` 字段 | 返回 BLS 签名 | 返回 BLS 签名（唯一有效负载） |
| 获取 randomness 方式 | 直接从响应取 | 需计算 `SHA-256(signature)` |

[来源](GUIDE.md#L329-L333)

项目统一使用 **v1 API**，原因在其兼容性：v1 直接提供 `randomness` 字段，无需额外的哈希计算步骤，降低了跨平台实现出错的概率。前端 `fetchBeacon` 明确从响应中提取 `data.randomness`，CLI 的 `fetch_randomness` 返回 `data['randomness']`，二者都依赖 v1 的字段存在性。

值得注意的是 `randomness` 并非独立随机值——它实际上是从 BLS 签名通过哈希派生而来（v2 显式化这一步骤），但这对调用方透明：在 [抽奖核心算法](抽奖核心算法.md) 中，`deriveSeed` 函数以 `randomness` 为输入执行 `SHA-256(randomness + ':' + shift)`，无论 randomness 的来源是 v1 的直接字段还是 v2 的计算结果，后续的种子派生逻辑不变。[来源](src/lottery.js#L10-L13)

## 8 秒超时设计决策

前端的 8 秒超时通过 `AbortSignal.timeout(8000)` 实现，这是对三方面因素的权衡：

- **drand 轮次周期**：QuickNet 和 EVMNet 每 3 秒产生一个信标，Default 链每 30 秒。8 秒大于 QuickNet 两轮周期，允许在网络延迟下获取到相邻轮次的数据。
- **用户体验**：超过 8 秒无响应即切换 relay，用户几乎无感知；加上 `fetchWithRetry` 的多达 5 次重试，最坏情况下等待约 40 秒后报错，但大部分情况下首 relay 在 1-2 秒内返回。
- **浏览器限制**：`AbortSignal.timeout` 是 Web API 标准，兼容所有现代浏览器。

CLI 端使用 10 秒超时略长于前端，因为 CLI 没有用户等待的心理负担，且可能运行在网络条件更差的环境中。

## 链配置与 relay 映射

三条 drand 链在 `src/chains.js` 中完整定义，relay 列表是链的元属性之一。每条链的 `relays` 数组指向相同的三个 relay 端点。[来源](src/chains.js#L3-L54)

| 链 | 链 ID | 轮次周期 | relay 列表 |
|----|-------|---------|-----------|
| QuickNet | `quicknet` | 3 秒 | 同上三条 |
| Default | `default` | 30 秒 | 同上三条 |
| EVMNet | `evmnet` | 3 秒 | 同上三条 |

三条链共享 relay 列表是 drand 网络的架构特征——relay 是中立的代理层，不绑定具体链。每条链由其 `chainHash` 路由，relay 仅负责转发请求到正确的信标。关于链参数的详细对比，参见 [链配置系统](链配置系统.md)。

`fetchBeacon(chainId, round)` 函数以 `chainId` 为入口，从 `CHAINS` 中查找链配置，用其 `chainHash` 构建 URL 路径，用其 `relays` 列表进行故障切换。[来源](src/api.js#L14-L24)

## 验证场景的重试策略

在验证场景（`DrawStatus.js` 的 `performVerification` 和 `performVerificationByRound` 函数）中，drand API 调用并非一次性失败即止，而是通过 `fetchWithRetry` 进一步包装：

```js
async function fetchWithRetry(chain, round, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchBeacon(chain, round)
    } catch {
      if (attempt >= maxRetries - 1) throw new Error('Failed to fetch beacon after retries')
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}
```

[来源](src/components/DrawStatus.js#L7-L13)

这与开奖场景（`renderAwaitDraw` 中的 `fetchBeacon` 调用）的行为不同：开奖时重试间隔为 3 秒且无外层封装函数，直接内联在事件监听中。[来源](src/components/DrawStatus.js#L167-L175)

两种场景的差异反映了使用意图——验证是"检查已存在的结果"，重试间隔较短以快速给出验证反馈；开奖是"等待信标就绪"，重试间隔较长以避免在轮次边界频繁请求尚未生成的信标。

## 架构模式小结

```
用户请求
  │
  ▼
fetchBeacon(chainId, round)
  │
  ├── 从 CHAINS 查找 chainHash 和 relays
  │
  └── fetchWithFallback(relays, path)
        │
        ├── ▶ api.drand.sh + path ── 成功 → 返回 JSON
        │     └── 失败/超时
        │           │
        │           └── ▶ api2.drand.sh + path ── 成功 → 返回 JSON
        │                 └── 失败/超时
        │                       │
        │                       └── ▶ drand.cloudflare.com + path ── 成功 → 返回 JSON
        │                             └── 失败 → 抛 Error
        │
        └── 返回 { round, randomness, signature }
              │
              ▼
        抽奖算法: SHA-256(randomness + ':0') → 种子
```

两个平台（前端 JS 和 CLI Python）遵循完全相同的架构模式，区别仅在于 HTTP 客户端和返回值的精炼程度。这种跨平台的一致性保证了同一组参数在浏览器中和命令行中产生完全相同的中奖结果，详见 [抽奖核心算法](抽奖核心算法.md)。

## 相关链接

- [链配置系统](链配置系统.md) — 三条 drand 链的完整参数对比
- [CLI 工具安装与基础用法](cli-工具安装与基础用法.md) — CLI 的使用方式
- [攻击面分析与信任模型](攻击面分析与信任模型.md) — 多 relay 比对对信任模型的影响
- [三态页面渲染机制](三态页面渲染机制.md) — fetchWithRetry 在 UI 中的使用上下文