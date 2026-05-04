# drand-draw 算法规范

> 本文件从完整指南中提取算法规范部分，供开发者独立复现抽奖结果。
> 完整使用指南见 [GUIDE.md](public/GUIDE.md) | [GUIDE_EN.md](public/GUIDE_EN.md)

---

## 1. 参与列表排序与编号

```
输入:  参与者用户名列表（字符串数组）
输出:  编号 0 到 N-1 的有序列表

步骤:
  1. 去重：移除重复的用户名
  2. 排序：按 ASCII 码升序排列
     "0" < "9" < "@" < "A" < "Z" < "_" < "a" < "z"
  3. 编号：从 0 开始依次分配
     N = 有效参与用户总数
```

## 2. Round 计算

```
对每条 drand 链:

┌──────────┬──────────────────────────────────────────────────┬────────────┬──────────┐
│ 链       │ chain_hash                                      │ genesis_ts │ period   │
├──────────┼──────────────────────────────────────────────────┼────────────┼──────────┤
│ quicknet │ 52db9ba70e0cc0f6eaf7803dd07447a1f5477735        │ 1692803367 │ 3        │
│          │ fd3f661792ba94600c84e971                         │            │          │
├──────────┼──────────────────────────────────────────────────┼────────────┼──────────┤
│ default  │ 8990e7a9aaed2ffed73dbd7092123d6f2899305         │ 1595431050 │ 30       │
│          │ 40d7651336225dc172e51b2ce                        │            │          │
├──────────┼──────────────────────────────────────────────────┼────────────┼──────────┤
│ evmnet   │ 04f1e9062b8a81f848fded9c12306733282b2727        │ 1727521075 │ 3        │
│          │ ecced50032187751166ec8c3                         │            │          │
└──────────┴──────────────────────────────────────────────────┴────────────┴──────────┘

round = floor((deadline - genesis_ts) / period) + 1
```

## 3. 获取随机数

```
GET https://api.drand.sh/{chain_hash}/public/{round}

响应:
{
  "round": 7398878,
  "randomness": "a3f25c8d1e7b...",  // 64字符十六进制
  "signature": "92daf574..."
}

备用 relay:
  - api.drand.sh
  - api2.drand.sh
  - drand.cloudflare.com
```

## 4. 中奖计算

```
function computeWinners(randomness, N, prizeTiers):
  if sum(prizeTiers) > N:
    throw Error("Total prizes exceeds N")

  winners = []
  used = {}

  for i in 0..len(prizeTiers)-1:
    for j in 0..prizeTiers[i]-1:
      shift = len(winners)
      seedHex = randomness + toHex(shift)     // 拼接, 无 0x 前缀
      bigVal = BigInt('0x' + seedHex)
      idx = bigVal % N

      attempts = 0
      while idx in used:
        idx = (idx + 1) % N
        attempts++
        if attempts >= N:
          throw Error("Collision resolution failed")

      used.add(idx)
      winners.append(idx)

  return winners
```

每个奖位使用 randomness 的不同分片: `randomness + shift`
- shift = 0, 1, 2, ... 对应第 1、2、3... 个奖位
- 碰撞时顺延到下一个未被占用的编号（环形查找）

## 5. 短码编码

```
格式: {chain}-{deadline_hex}-{N_base36}-{prizes}-{winners}

chain:  q=quicknet, d=default, e=evmnet
deadline:  小端十六进制（不含 0x）
N:         base36 编码（0-9a-z）
prizes:    逗号分隔的 base36 数字（可选）
winners:   逗号分隔的 base36 数字（可选）

示例:
  q-66364280-2s-1,3            ← 仅配置
  q-66364280-2s-1,3-2a,f,4e   ← 含中奖编号
```

## 6. 验证步骤

```
1. 确认 deadline 和 N
2. round = floor((deadline - genesis) / period) + 1
3. 获取 randomness:
   curl https://api.drand.sh/{chain_hash}/public/{round}
4. 计算中奖编号（用上面的 computeWinners）
5. 比对结果
```

命令行验证示例:

```bash
CHAIN_HASH="52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971"
ROUND=7398878
N=100

RANDOMNESS=$(curl -s "https://api.drand.sh/${CHAIN_HASH}/public/${ROUND}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['randomness'])")

python3 -c "
r = '$RANDOMNESS'
N = $N
prizes = [1, 3]
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

## 7. 安全边界

| 参数 | 最大值 | 说明 |
|------|--------|------|
| N | 1,048,575 | 约 100 万参与者 |
| 奖项层级 | 15 层 | 一等奖到十五等奖 |
| 每层人数 | 1,000 | 每个奖项最多 1000 人 |
| deadline | 2106 年 | Unix 32 位时间戳上限 |

---

License: MIT © 2026 Epheia
