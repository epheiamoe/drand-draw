# drand-draw CLI

基于 drand 去中心化随机数的可验证抽奖 — 命令行版。

算法与网页版完全一致（Round计算、Winner计算、短码编解码均相同）。

## 安装

```bash
# 前提：Python 3.10+
pip install .
```

或直接用（不安装）：

```bash
python -m drand_draw <command> [options]
```

## 命令

### verify — 验证抽奖结果

从 drand 获取指定 round 的随机数，计算中奖编号并与声明的结果比对。

```bash
drand-draw verify --chain quicknet --round 7398878 --n 100 --prizes 1,3 --winners 42,15,78,33
```

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `--chain` | 是 | drand 网络：quicknet / default / evmnet |
| `--round` | 是 | Round 编号 |
| `--n` | 是 | 参与人数 |
| `--prizes` | 是 | 各奖项人数，逗号分隔，如 `1,3` |
| `--winners` | 是 | 中奖编号，逗号分隔，如 `42,15,78,33` |

输出示例：

```
Round: #7398878
Randomness: a3f25c8d1e7b...
Prize Tier 1 (1 winner): #42  ✅
Prize Tier 2 (3 winners): #15, #78, #33  ✅
Verification: PASSED
```

### compute — 计算开奖结果

从截止时间和 N 计算中奖编号（用于开奖）。

```bash
drand-draw compute --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3
```

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `--chain` | 是 | drand 网络 |
| `--deadline` | 是 | 截止时间戳（Unix 秒） |
| `--n` | 是 | 参与人数 |
| `--prizes` | 是 | 各奖项人数，逗号分隔 |

输出示例：

```
Deadline: 2026-05-06 12:53:20 UTC
Round: #7398878
Randomness: a3f25c8d1e7b...
Prize Tier 1 (1 winner): #42
Prize Tier 2 (3 winners): #15, #78, #43
```

### encode — 参数编码为短码

将抽奖参数编码为短码（用于在社交平台分享，避免外链限流）。

```bash
drand-draw encode --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3
drand-draw encode --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3 --winners 42,15,78,33
```

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `--chain` | 是 | drand 网络 |
| `--deadline` | 是 | 截止时间戳 |
| `--n` | 是 | 参与人数 |
| `--prizes` | 否 | 各奖项人数 |
| `--winners` | 否 | 中奖编号 |

输出：短码字符串，如 `q-66364280-2s-1,3`

### decode — 短码解码为参数

将短码解码为人类可读的参数。

```bash
drand-draw decode "q-66364280-2s-1,3"
drand-draw decode "q-66364280-2s-1,3-2a,f,4e"
```

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `code` | 是 | 短码字符串 |

输出示例：

```
Chain: quicknet
Deadline: 1715000000 (2026-05-06 12:53:20 UTC)
N: 100
Prizes: 1, 3
Winners: #42, #15, #78
```

## 开发

```bash
# 直接运行（不安装）
python -m drand_draw verify ...
```

## 算法

核心算法与网页版完全一致，详见 [public/GUIDE.md](../public/GUIDE.md) 算法规范章节。
