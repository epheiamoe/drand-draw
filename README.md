# drand-draw

**可验证抽奖 / Verifiable Lottery** — 基于 drand 去中心化随机数网络的社交平台抽奖工具。

给 X/Twitter 博主用的抽奖工具：设截止时间 → 粉丝参与 → 截止后用 drand 随机数开奖 → 结果公开可验证。

**这不是 Web3/NFT 项目，不运行在区块链上，不存储任何数据。**

## 快速使用

### 网页版

访问 https://drand-draw.pages.dev

- **验证抽奖**：粘贴链接或短码，或手动输入 Round / N / 中奖编号，一键验证
- **发起抽奖**：填写 N、截止时间、奖项，生成链接/短码

### CLI 版

```bash
cd cli
pip install .
drand-draw verify --chain quicknet --round 1234567 --n 100 --prizes 1 --winners 42
drand-draw compute --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3
drand-draw encode --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3
drand-draw decode "q-66364280-2s-1,3"
```

详细用法见 [cli/README.md](cli/README.md)

## 项目结构

```
drand-draw/
├── index.html              # 网页入口
├── src/                    # 前端源码 (Vite + Tailwind v4)
│   ├── main.js             # 路由 / 语言切换
│   ├── lottery.js          # 抽奖核心算法（与 CLI 版一致）
│   ├── encode.js           # 短码编解码
│   ├── api.js              # drand HTTP API 封装
│   ├── chains.js           # 三条链配置
│   ├── i18n.js             # 中英双语
│   ├── markdown.js         # markdown 运行时渲染
│   ├── icons.js            # Lucide SVG 图标
│   ├── style.css           # Tailwind v4 + 暗色主题
│   └── components/         # UI 组件
├── cli/                    # Python CLI 版
│   ├── drand_draw/         # CLI 源码
│   │   ├── lottery.py      # 抽奖核心算法（与网页版一致）
│   │   ├── encode.py       # 短码编解码
│   │   ├── api.py          # drand HTTP API 封装
│   │   └── __main__.py     # CLI 入口
│   └── pyproject.toml      # Python 包配置
├── public/                 # 静态文件
│   ├── GUIDE.md            # 中文完整指南
│   └── GUIDE_EN.md         # 英文完整指南
├── PLAN.md                 # 设计文档
└── wrangler.toml           # Cloudflare Pages 配置
```

## 自行部署

### 网页版 (Cloudflare Pages)

```bash
# 前提：已安装 nodejs + npm，已 wrangler 登录
git clone https://github.com/epheiamoe/drand-draw.git
cd drand-draw
npm install
npm run build
wrangler pages deploy ./dist --project-name drand-draw --branch main
```

或通过 Cloudflare Dashboard → Pages → 连接 Git 仓库 → 自动部署。

### CLI 版

```bash
# 前提：已安装 Python 3.10+
cd cli
pip install .
drand-draw --help
```

## 算法一致性

网页版 (JavaScript) 和 CLI 版 (Python) 的核心算法**完全一致**：

| 算法 | 公式 |
|------|------|
| Round 计算 | `floor((deadline - genesis) / period) + 1` |
| 种子 | `randomness + hex(shift)` (shift = 0, 1, 2...) |
| 中奖编号 | `BigInt('0x' + seed) % N` |
| 碰撞处理 | `(idx + 1) % N` 顺延 |
| 短码 | `{chain}-{deadline_hex}-{N_base36}-{prizes}-{winners}` |

## License

MIT © 2026 Epheia

## 链接

- [drand 官网](https://drand.love)
- [drand HTTP API 文档](https://docs.drand.love/developer/http-api/)
- [网页版](https://drand-draw.pages.dev)
