# drand 可验证抽奖平台

## 概述

基于 [drand (Distributed Randomness Beacon)](https://drand.love) 的去中心化随机数，提供公开可验证的社交平台抽奖工具。

### 核心特性

- **完全透明**：抽奖结果由 drand 的公开随机数决定，任何人都可独立验证
- **零后台**：纯静态页面，部署在 Cloudflare Pages，不存储任何数据
- **中英双语**：自动检测浏览器语言，手动可切换
- **多链支持**：支持 quicknet(3s)、default(30s)、evmnet(3s) 三条 drand 网络
- **多奖项**：支持一/二/三等奖等多层级配置
- **短码分享**：支持 URL 和短码两种分享方式，避免外链限流

## 攻击面分析

### 防止的问题

| 攻击方式 | 防御机制 |
|----------|----------|
| 博主在看到 randomness 后选择有利的 round | Round 由 deadline 唯一确定，deadline 在 URL/短码中锁定，不可更改 |
| 博主对不同的验证者说不同的 N | N 在 URL/短码中锁定，页面直接解码显示 |
| 博主使用不同的排序规则 | 排序规则由页面硬编码声明（ASCII 升序），博主无法否认 |
| 博主篡改 drand 返回的随机数 | drand 返回结果由 League of Entropy 多节点签名，可通过 drand-client 验证 |
| 博主多次开奖直到满意 | 同一个 URL/短码只能产出一个结果，粉丝可自行验证 |

### 仍需社会约束的

- 博主需在 deadline 前公开 URL/短码（即公布抽奖时就要给出链接）
- 博主需在 Phase 2 公开完整候选列表，粉丝需自行核对名单
- 候选列表的去重（一个用户多次点赞算一次）需博主诚信处理

## 系统架构

```
┌─────────────────────────────────────────────────┐
│                  Cloudflare Pages                │
├─────────────────────────────────────────────────┤
│  index.html                                      │
│  src/                                            │
│  ├── main.js           ← 入口 + Hash 路由         │
│  ├── chains.js         ← 三条链配置               │
│  ├── i18n.js           ← 中英双语翻译              │
│  ├── encode.js         ← 短码 ⇄ 编解码             │
│  ├── api.js            ← drand HTTP API 封装      │
│  ├── lottery.js        ← 抽奖核心算法              │
│  ├── icons.js          ← Lucide SVG 图标           │
│  ├── components/                                  │
│  │   ├── CreateDraw.js  ← 发起抽奖表单              │
│  │   ├── DrawStatus.js  ← 三态开奖/验证页面          │
│  │   └── Guide.js       ← 原理/规则/使用说明        │
│  └── style.css                                    │
├── package.json                                    │
├── vite.config.js                                  │
└── wrangler.toml                                   │
└─────────────────────────────────────────────────┘
```

## 核心算法

### Round 计算

```javascript
// 对于 unchained 链 (quicknet, evmnet)
round = Math.floor((deadlineUnix - genesisTime) / period) + 1

// 对于 chained 链 (default)
round = Math.floor((deadlineUnix - genesisTime) / period) + 1
// + 额外的 fallback 逻辑
```

### 中奖计算

```javascript
function computeWinners(randomness, n, prizeTiers) {
  // prizeTiers = [1, 3] 表示 1 个一等奖 + 3 个二等奖
  const winners = []
  const used = new Set()
  for (let i = 0; i < prizeTiers.length; i++) {
    for (let j = 0; j < prizeTiers[i]; j++) {
      let idx = BigInt('0x' + randomness + winners.length.toString(16)) % BigInt(n)
      while (used.has(Number(idx))) {
        idx = (idx + 1n) % BigInt(n) // 碰撞顺延
      }
      used.add(Number(idx))
      winners.push(Number(idx))
    }
  }
  return winners
}
```

每个奖位使用 randomness 的不同分片：`randomness + shift_index`，保证各奖位结果独立。

## 页面三态

同一个 URL/短码在不同时间呈现不同状态：

### 状态 1 — 截止前

显示截止倒计时、预计使用的 round 号、奖项配置。

### 状态 2 — 已截止未开奖

显示"等待开奖"，博主可点击开奖按钮（触发 drand 查询），或系统自动查询。

### 状态 3 — 已开奖

展示完整的验证结果：drand round、随机数、各奖项中奖编号、计算过程。

## 分享方式

### URL 格式

```
#/?chain=quicknet&deadline=1715000000&n=100&prizes=1,3&winners=42,15,78,33
```

### 短码格式

```
q-66364280-2s-1,3-2a,f,4e,21
```

短码编码规则：
- 首字母: `q`=quicknet, `d`=default, `e`=evmnet
- deadline: 小端十六进制
- N: base36
- prizes: 逗号分隔的 base36 数字
- winners: 逗号分隔的 base36 数字

## 排序规则声明

页面硬编码以下规则，博主必须遵守，粉丝可据此核对：

> **候选列表排序规则**
> 1. 收集所有参与者的 X Handle (@username)
> 2. 按 ASCII 码升序排列（数字 → 大写字母 → 小写字母）
> 3. 从 0 开始依次编号
> 4. 公开完整编号列表

## 技术栈

| 组件 | 选择 |
|------|------|
| 构建工具 | Vite 6 |
| 语言 | Vanilla JavaScript (ES Modules) |
| 样式 | Tailwind CSS v4 |
| 图标 | Lucide Icons |
| 随机数源 | drand HTTP API (直接 fetch) |
| 部署 | Cloudflare Pages (wrangler) |

## 部署

```bash
# 构建
npm run build

# 部署
wrangler pages deploy ./dist --project-name drand-draw
```

## 使用流程

### 博主发起抽奖

1. 打开网站，选择"发起抽奖"
2. 选择 drand 链（推荐 quicknet，3 秒一轮）
3. 填写参与人数 N、截止时间、奖项配置
4. 点击生成，获得链接/短码
5. 将链接/短码公布在社交平台
6. 截止时间后，打开同一链接点击开奖
7. 将开奖结果（含 winners 参数的链接或短码）公布

### 粉丝验证抽奖

1. 打开博主公布的链接，或打开网站输入短码
2. 页面自动展示：
   - 截止前：倒计时
   - 截止后：开奖结果 + 自动验证

### 手动验证

即使没有链接，粉丝也可：
1. 打开 drand-draw.pages.dev
2. 选择"验证"
3. 手动输入：链 / deadline / N / 中奖编号
4. 页面从 drand 拉取数据并验证
