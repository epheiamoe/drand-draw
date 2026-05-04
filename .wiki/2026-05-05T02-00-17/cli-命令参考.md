# CLI 命令参考

`drand-draw` 是 drand 去中心化随机数抽奖的命令行工具，提供与网页版完全一致的算法实现。它支持完整的抽奖生命周期：**计算开奖结果**、**验证中奖声明**，以及**编码/解码短码**以供社交平台分享。

---

## 安装

前提：Python 3.10+

```bash
pip install .
```

也可以不安装，直接通过 `python -m` 运行：

```bash
python -m drand_draw <command> [options]
```

入口由 `pyproject.toml` 的 `[project.scripts]` 段声明，将 `drand-draw` 命令映射到 `drand_draw.__main__:main`。[来源](cli/pyproject.toml#L1-L8)

---

## 全局行为

- `--chain` 的可选值固定为三个：`quicknet`、`default`、`evmnet`，分别对应 drand 的三条链。映射关系存储在 `encode.CHAINS` 字典中。[来源](cli/drand_draw/encode.py#L1-L20)
- `--prizes` 使用**逗号分隔**的整数列表，如 `1,3,5` 表示一等奖1人、二等奖3人、三等奖5人。
- `--deadline` 是 **Unix 时间戳**（秒），表示截止时间。
- 所有命令都通过 `argparse` 子解析器派发，执行对应的 `cmd_*` 函数。[来源](cli/drand_draw/__main__.py#L96-L126)

---

## verify — 验证中奖结果

从 drand 网络获取指定 round 的随机数，重新计算中奖编号并与声明的 `--winners` 逐级比对，输出每级是否匹配。

### 参数

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `--chain` | 是 | 枚举 | `quicknet` / `default` / `evmnet` |
| `--round` | 是 | int | drand round 编号 |
| `--n` | 是 | int | 参与总人数 |
| `--prizes` | 是 | str | 各奖项人数，逗号分隔 |
| `--winners` | 是 | str | 声明的中奖编号，逗号分隔 |

### 算法流程

1. 调用 `api.fetch_randomness(chain_hash, round)` 从多个 Relay 并行获取随机数。[来源](cli/drand_draw/api.py#L13-L26)
2. 调用 `lottery.compute_winners(randomness, n, prize_tiers)` 计算出标准结果。[来源](cli/drand_draw/lottery.py#L10-L26)
3. 逐级比对，输出 ✅ 或 ❌。[来源](cli/drand_draw/__main__.py#L22-L50)

### 示例

**例 1：基础验证**

```bash
drand-draw verify --chain quicknet --round 7398878 --n 100 --prizes 1,3 --winners 42,15,78,33
```

```
Round: #7398878
Randomness: a3f25c8d...
Prize Tier 1 (1 winner): #42  ✅
Prize Tier 2 (3 winners): #15, #78, #33  ✅
Verification: PASSED
```

**例 2：验证失败（有作弊嫌疑）**

```bash
drand-draw verify --chain default --round 5000000 --n 200 --prizes 2 --winners 7,99
```

```
Round: #5000000
Randomness: b7e2d1f...
Prize Tier 1 (2 winners): claimed #7, #99, computed #12, #88  ❌
Verification: FAILED
```

**例 3：使用 evmnet 链**

```bash
drand-draw verify --chain evmnet --round 1200000 --n 50 --prizes 1 --winners 33
```

---

## compute — 从 deadline 计算中奖者

当抽奖截止后，输入截止时间戳和参与人数，CLI 自动推算对应的 drand round、获取随机数并计算中奖编号。博主使用此命令开奖。

### 参数

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `--chain` | 是 | 枚举 | `quicknet` / `default` / `evmnet` |
| `--deadline` | 是 | int | 截止时间戳（Unix 秒） |
| `--n` | 是 | int | 参与总人数 |
| `--prizes` | 是 | str | 各奖项人数，逗号分隔 |

### 算法流程

1. 调用 `lottery.compute_round(deadline, genesis, period)` 推算 round 编号：`⌊(deadline − genesis) / period⌋ + 1`。[来源](cli/drand_draw/lottery.py#L3-L8)
2. 获取该 round 的随机数。
3. 计算中奖者，输出截止时间（格式化为 UTC）、round、随机数及各奖项中奖编号。[来源](cli/drand_draw/__main__.py#L52-L79)

### 示例

**例 1：单奖项**

```bash
drand-draw compute --chain quicknet --deadline 1715000000 --n 100 --prizes 1
```

```
Deadline: 2026-05-06 12:53:20 UTC
Round: #7398878
Randomness: a3f25c8d...
Prize Tier 1 (1 winner): #42
```

**例 2：多奖项**

```bash
drand-draw compute --chain default --deadline 1700000000 --n 500 --prizes 2,5,10
```

```
Deadline: 2023-11-14 22:13:20 UTC
Round: #3482398
Randomness: 9fe2a1b...
Prize Tier 1 (2 winners): #101, #304
Prize Tier 2 (5 winners): #22, #77, #156, #299, #488
Prize Tier 3 (10 winners): #3, #41, #55, ...
```

**例 3：将结果通过短码分享**

先 compute 获取结果，再用 encode 生成短码（见下文），方便在社交平台公示。

---

## encode — 编码短码

将抽奖参数编码为紧凑的短码字符串，避开 URL 长度限制和外链屏蔽。

### 参数

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `--chain` | 是 | 枚举 | `quicknet` / `default` / `evmnet` |
| `--deadline` | 是 | int | 截止时间戳 |
| `--n` | 是 | int | 参与总人数 |
| `--prizes` | 否 | str | 各奖项人数，逗号分隔 |
| `--winners` | 否 | str | 中奖编号，逗号分隔 |

编码后的短码格式为 `{前缀}-{deadline_hex}-{n_base36}`，可选附加 `-{prizes_base36}-{winners_base36}`。链前缀映射：quicknet → `q`，default → `d`，evmnet → `e`。[来源](cli/drand_draw/encode.py#L34-L42)

短码的完整设计规范参见 [短码设计与编解码](短码设计与编解码.md)。

### 示例

**例 1：仅编码参数（不含中奖结果）**

```bash
drand-draw encode --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3
```

```
q-66364280-2s-1,3
```

**例 2：编码参数+中奖结果（包含 winners）**

```bash
drand-draw encode --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3 --winners 42,15,78,33
```

```
q-66364280-2s-1,3-16,f,26,11
```

**例 3：使用 evmnet 链**

```bash
drand-draw encode --chain evmnet --deadline 1728000000 --n 50 --prizes 2,1
```

```
e-66fbc480-1e-2,1
```

---

## decode — 解码短码

将短码还原为人类可读的参数。

### 参数

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `code` | 是 | str | 短码字符串（位置参数，无 `--` 前缀） |

解码逻辑：按 `-` 分割，提取前缀映射回链名、将十六进制 deadline 转回整数、将 base36 的 n/prizes/winners 转回十进制。[来源](cli/drand_draw/encode.py#L44-L63)

### 示例

**例 1：解码不含 winners 的短码**

```bash
drand-draw decode "q-66364280-2s-1,3"
```

```
Chain: quicknet
Deadline: 1715000000 (2026-05-06 12:53:20 UTC)
N: 100
Prizes: 1, 3
```

**例 2：解码包含 winners 的短码**

```bash
drand-draw decode "q-66364280-2s-1,3-16,f,26,11"
```

```
Chain: quicknet
Deadline: 1715000000 (2026-05-06 12:53:20 UTC)
N: 100
Prizes: 1, 3
Winners: #42, #15, #78, #33
```

**例 3：解码其他链的短码**

```bash
drand-draw decode "d-5f5e1000-1g"
```

```
Chain: default
Deadline: 1600000000 (2020-09-13 12:26:40 UTC)
N: 32
```

---

## 下一步

- 理解短码设计原理 → [短码设计与编解码](短码设计与编解码.md)
- 了解 CLI 内部模块结构与 JavaScript 端的算法一致性保证 → [CLI 实现与跨语言一致性](cli-实现与跨语言一致性.md)
- 学习 drand 三条链的差异 → [理解 drand 去中心化随机数](理解-drand-去中心化随机数.md)
- 阅读算法完整规范 → [算法规范独立文档](算法规范独立文档.md)