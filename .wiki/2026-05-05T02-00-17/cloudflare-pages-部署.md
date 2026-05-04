# Cloudflare Pages 部署

drand-draw 是一个纯前端 SPA 应用——没有后端服务、没有 Serverless Functions、没有数据库。这意味着它的部署模型极其简单：将 `dist/` 目录中的静态文件上传到 Cloudflare Pages 即可。本文将从零开始，覆盖 CLI 手动部署和 Git 自动部署两种方式。

---

## 前置条件

在开始部署之前，需要准备好以下环境：

- **Node.js** ≥ 18（推荐 v20 LTS）。Vite 6 需要 Node 18+。[来源](package.json#L15-L17)
- **npm**（随 Node.js 一同安装）。
- **Wrangler CLI**（Cloudflare 官方部署工具），全局安装：`npm install -g wrangler`。
- 一个 **Cloudflare 账号**，并且域名已接入 Cloudflare（可选但推荐）。

安装 Wrangler 后，用以下命令登录：

```bash
wrangler login
```

该命令会在浏览器中打开 Cloudflare 认证页面，授权 Wrangler 管理你的 Pages 项目。登录状态会持久化存储在本地。

> 如果不使用 Wrangler，也可以直接通过 Cloudflare Dashboard 操作，详见下方的[自动部署](#通过-cloudflare-dashboard-自动部署)一节。

---

## 项目构建配置

部署核心涉及三个文件，理解它们之间的配合是关键。

### vite.config.js

```js
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

极简配置：只加载 Tailwind CSS v4 的 Vite 插件，无特殊输出路径、无 base 路径、无 proxy 设置。这意味着：

- 构建输出使用 Vite 默认路径：`dist/`
- 资源路径使用默认相对路径（`/assets/index-xxx.js`）[来源](dist/index.html#L9-L10)
- 开发服务器用 `vite dev` 启动，生产构建用 `vite build` [来源](package.json#L6-L8)

### wrangler.toml

```toml
name = "drand-draw"
compatibility_date = "2026-05-04"
pages_build_output_dir = "dist"
```

三个字段，各司其职：

| 字段 | 值 | 含义 |
|------|-----|------|
| `name` | `drand-draw` | Cloudflare Pages 项目名称，同时也是默认的 `<project>.pages.dev` 域名前缀 |
| `compatibility_date` | `2026-05-04` | Workers 运行时兼容性日期，告诉 Cloudflare 使用哪个版本的 API 行为。对本纯静态项目影响不大，但 `wrangler pages` 命令需要此字段 |
| `pages_build_output_dir` | `dist` | **核心字段**——告诉 Wrangler 构建产物的输出目录是 `dist/`，部署时会上传该目录下所有文件 |

[来源](wrangler.toml#L1-L4)

### `pages_build_output_dir = "dist"` 的含义

这是整个部署配置中最重要的概念。它的工作流程如下：

```
源码目录                    构建                   部署
───────                   ──────                ──────
index.html  ──┐                                    │
src/main.js  ─┤  ───  vite build  ────→  dist/  ───┤──→  Cloudflare Pages
src/style.css ─┤                  (产物目录)        │     (生产环境)
...           ─┘                                    │
                                                   /
                              pages_build_output_dir = "dist"
```

Wrangler 读取此配置后，会将 `dist/` 目录映射为 Pages 的根路径（`/`）。目录结构展示：

```
dist/
├── index.html              # 入口 HTML
├── favicon.svg             # 网站图标
├── GUIDE.md                # 中文使用指南
├── GUIDE_EN.md             # 英文使用指南
└── assets/
    ├── index-xxxxx.js      # 打包后的 JS
    └── index-xxxxx.css     # 打包后的 CSS
```

Vite 构建时会自动将 `index.html` 中引用的 `src/main.js` 编译、打包、哈希，并输出到 `assets/` 目录。`public/` 目录下的静态文件（`favicon.svg`、`GUIDE.md`、`GUIDE_EN.md`）则被原样复制到 `dist/` 根目录。[来源](dist/index.html#L1-L22)

---

## CLI 手动部署（推荐用于 CI/CD）

以下是从源码到生产环境的完整命令行流程。

### 第一步：安装依赖

```bash
npm install
```

读取 `package.json`，安装 `drand-client`（运行时依赖）以及 `vite`、`tailwindcss`、`@tailwindcss/vite`（开发依赖）。[来源](package.json#L10-L17)

### 第二步：构建

```bash
npm run build
```

等同于 `vite build`。Vite 执行以下操作：

1. 解析 `index.html` 中的 `<script type="module" src="/src/main.js">`
2. 从 `main.js` 开始，递归解析所有 import 的模块（`lottery.js`、`api.js`、`encode.js` 等）
3. 通过 Rollup（Vite 底层打包器）将代码树打包为单个优化的 JS 文件
4. 对 CSS（Tailwind）做同样的处理
5. 输出到 `dist/` 目录，生成的文件名带内容哈希用于缓存失效

构建成功后的 `dist/` 目录结构如上节所示。

### 第三步：部署到 Cloudflare Pages

```bash
npx wrangler pages deploy dist/
```

或者使用全局安装的 Wrangler：

```bash
wrangler pages deploy dist/
```

此命令会：

1. 读取 `wrangler.toml` 获取项目名和配置
2. 将 `dist/` 目录下所有文件上传到 Cloudflare
3. 如果项目不存在则自动创建，存在则创建新部署
4. 输出一个形如 `https://drand-draw-xxxxx.pages.dev` 的预览 URL

如果想部署到生产环境（覆盖当前生产域名），添加 `--branch production` 标志：

```bash
wrangler pages deploy dist/ --branch production
```

部署成功后，终端会显示两个 URL：**预览 URL**（每个部署独立）和 **生产 URL**（项目域名）。

### 完整脚本示例

```bash
#!/bin/bash
# deploy.sh — 一键部署到 Cloudflare Pages

npm install
npm run build
npx wrangler pages deploy dist/ --branch production
```

---

## 通过 Cloudflare Dashboard 自动部署

如果你的项目托管在 GitHub/GitLab 上，可以配置 Cloudflare Pages 监听仓库变更，每次推送自动构建部署。

### 配置步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**。
2. 授权 Cloudflare 访问你的 GitHub/GitLab 仓库，选择 `epheiamoe/drand-draw`（或你的 fork）。
3. 在 **Build settings** 中配置：

   | 设置项 | 值 |
   |--------|-----|
   | 框架预设 | **None**（或手动填写） |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory（可选） | `/` |

4. 点击 **Save and Deploy**。

Cloudflare 会自动拉取代码、执行 `npm install && npm run build`，然后将 `dist/` 目录发布到 `https://drand-draw.pages.dev`。

### 自动部署的优点

- **零手动操作**：每次推送到主分支，Cloudflare 自动构建。
- **预览部署**：对 PR 自动生成预览 URL，方便在合并前验证变更。
- **回滚**：Dashboard 中保留部署历史，可一键回滚到任一历史版本。

---

## 部署后检查清单

部署完成后，建议做以下验证：

- [x] **首页正常加载**：访问域名，确认 SPA 正确渲染
- [x] **抽奖功能可用**：填写参数发起一次抽奖，确认能获取 drand 随机数
- [x] **GUIDE 文档可访问**：确认 `GUIDE.md` 和 `GUIDE_EN.md` 能正常打开
- [x] **SPA 路由正常**：对于基于 Hash 路由的应用（详见 [SPA 路由与页面三态](spa-路由与页面三态.md)），Hash 路由无需服务端处理，但需确认 `/#/draw/xxx` 等路径正常
- [x] **自定义域名**（可选）：在 Pages Dashboard 的 **Custom domains** 中添加你自己的域名，配置 CNAME 记录指向 `drand-draw.pages.dev`

---

## 常见问题

### Q: 部署后页面空白 / 资源 404

检查 `dist/index.html` 中引用的资源路径。Vite 默认使用绝对路径（`/assets/index-xxx.js`），这意味着资源必须位于域名根路径。如果部署在子路径下，需要在 `vite.config.js` 中设置 `base` 字段。本项目设计为部署在根路径，无需此设置。[来源](dist/index.html#L9-L10)

### Q: 如何验证部署的版本是否正确？

访问 `https://<project>.pages.dev` 后，打开浏览器开发者工具 → Network 标签，刷新页面，确认加载的 JS 文件哈希与本地 `dist/` 中的文件一致。

### Q: 需要配置环境变量吗？

本项目是纯静态 SPA，所有配置（如 drand 链参数）硬编码在源码中，**不需要**环境变量。如果未来需要，可以在 Cloudflare Dashboard → Pages 项目 → **Environment variables** 中设置。

### Q: Wrangler 提示 "No such file or directory"？

确认已在项目根目录（与 `wrangler.toml` 同级）执行命令。Wrangler 会在当前目录查找 `wrangler.toml` 配置。

---

## 推荐阅读

- 部署后，可参阅 [快速开始](快速开始.md) 发起你的第一次抽奖
- 了解抽奖安全模型，参见 [抽奖的安全模型](抽奖的安全模型.md)
- 如需理解部署内容与 drand 网络的交互方式，参见 [drand HTTP API 集成](drand-http-api-集成.md)
- 如果你对底层构建工具感兴趣，Vite 官方文档：[vitejs.dev](https://vitejs.dev/)