# Cloudflare Pages 部署

这个项目是一个纯前端 SPA——没有后端服务、没有数据库、没有构建时环境变量。部署到 Cloudflare Pages 只需三步：装依赖、构建、上传产物。本文覆盖两种部署方式（CLI 与 GitHub 集成），并解释背后的构建配置。

---

## 1. 前提条件

开始之前，确认本地环境满足以下要求：

- **Node.js 18+**（推荐 LTS 版本）
- **npm**（随 Node.js 一起安装）
- **Wrangler CLI**：已通过 `npm install -g wrangler` 安装并完成 `wrangler login` 身份验证

> 如果只需要 GitHub 自动部署（见第 3 节），则无需在本地安装 Wrangler。

[来源](README.md#L66-L71)

---

## 2. 构建

```bash
npm install
npm run build
```

`npm install` 安装两个运行时依赖和一个开发依赖：

| 包名 | 类型 | 用途 |
|------|------|------|
| `drand-client` | dependencies | drand 网络 HTTP API 的客户端封装 |
| `vite` | devDependencies | 开发服务器与构建打包 |
| `tailwindcss` + `@tailwindcss/vite` | devDependencies | Tailwind CSS v4 及其 Vite 插件 |

`npm run build` 实际执行 `vite build`，将 `index.html`（入口页）和 `src/` 目录下的源码打包到 `dist/` 目录。构建产物结构：

```
dist/
├── index.html
├── favicon.svg
├── assets/
│   ├── index-xxxxx.js        # 合并后的 JS 包
│   └── index-xxxxx.css       # 合并后的 CSS 包
├── GUIDE.md                  # 从 public/ 直接复制
└── GUIDE_EN.md               # 从 public/ 直接复制
```

`dist/` 目录下的 `index.html` 由 Vite 自动注入脚本标签，指向经过哈希处理的 JS/CSS 资源文件，确保缓存版本控制。

[来源](package.json#L3-L13) · [来源](index.html#L10-L10) · [来源](vite.config.js#L1-L4)

---

## 3. 部署方式

### 3.1 Wrangler CLI 部署

适合本地开发后直接发布：

```bash
wrangler pages deploy ./dist --project-name drand-draw --branch main
```

命令解释：

| 参数 | 值 | 含义 |
|------|------|------|
| `./dist` | 构建输出目录 | 与 `wrangler.toml` 中的 `pages_build_output_dir` 保持一致 |
| `--project-name` | `drand-draw` | Cloudflare Pages 上的项目名称 |
| `--branch` | `main` | 关联的 Git 分支，影响预览 URL 和生产域名 |

部署完成后，CLI 会输出一个 `.pages.dev` 预览域名。首次部署后可在 Cloudflare Dashboard 中绑定自定义域名。

### 3.2 GitHub 自动部署（推荐）

适合持续集成场景。操作步骤：

1. 将代码推送到 GitHub 仓库（本项目地址：`https://github.com/epheiamoe/drand-draw`）
2. 打开 Cloudflare Dashboard → **Workers & Pages** → **Pages**
3. 点击 **Connect to Git**，授权并选择该仓库
4. 在构建设置页面，保持以下默认配置（无需修改）：

| 配置项 | 值 |
|--------|------|
| 构建命令 | `npm run build` |
| 构建输出目录 | `dist` |
| 框架预设 | Vite（Cloudflare 会自动识别） |
| 环境变量（高级） | 无需设置 |

5. 点击 **Save and Deploy**。此后每次推送 `main` 分支，Cloudflare 会自动执行构建和部署。

两种方式的权衡：

| 维度 | CLI | GitHub 自动 |
|------|-----|-------------|
| 上手速度 | 快（本地配好即可推） | 需一次 Git 集成配置 |
| 回滚 | 手动指定版本 | Dashboard 点选回滚 |
| 预览分支 | `--branch` 参数手动控制 | 自动为 PR 生成预览 URL |
| 权限管理 | 依赖本地 wrangler 认证 | 团队协作时可统一管理 |

[来源](wrangler.toml#L1-L3) · [来源](README.md#L66-L71)

---

## 4. 构建配置详解

### 4.1 `vite.config.js`

```js
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

配置极其简洁：只加载了一个 **Tailwind v4 Vite 插件**。这是因为：

- **Tailwind v4** 采用了全新的 **CSS-first configuration** 范式。不再需要 `tailwind.config.js`，所有主题定制直接在 CSS 中通过 `@theme` 指令声明。
- 样式入口文件 `src/style.css` 第一行是 `@import "tailwindcss"`，Tailwind v4 插件解析这个导入并生成完整的工具类集合。

项目中未配置 `base`、`build.outDir` 等 Vite 选项，均使用 Vite 6 默认值：

| 选项 | 默认值 | 效果 |
|------|--------|------|
| `base` | `'/'` | 资源路径为绝对路径，适合部署到根域名 |
| `build.outDir` | `'dist'` | 产物输出到 `dist/` |
| `build.assetsInlineLimit` | 4096 (4KB) | 小图片/字体自动内联为 Base64 |

[来源](vite.config.js#L1-L4) · [来源](src/style.css#L1-L1)

### 4.2 `wrangler.toml`

```toml
name = "drand-draw"
compatibility_date = "2026-05-04"
pages_build_output_dir = "dist"
```

三个字段的含义：

- **`name`**：Cloudflare Pages 的项目名称，同时也是 `.pages.dev` 子域名的一部分（`drand-draw.pages.dev`）。
- **`compatibility_date`**：指定 Cloudflare Workers 运行时的兼容性日期。注意这个项目**并没有使用 Workers 功能**（没有 `functions/` 目录、没有 `_worker.js`），纯静态页面的部署实际上不依赖此字段。保留它的目的在于——未来如果需要添加边缘函数（如 API Proxy、URL 重写），这个日期决定了运行时行为。
- **`pages_build_output_dir = "dist"`**：告诉 Wrangler CLI 从 `dist/` 目录读取静态文件上传。当使用 CLI 部署时，这个值覆盖了命令行 `./dist` 参数的默认值。

**[关键理解]** 这个项目是一个 **Pure Static SPA**——所有逻辑在浏览器端执行，drand 随机数通过浏览器直接 fetch 公网 HTTP API 获取，不经过任何中间服务。因此 Cloudflare Pages 的职责仅仅是托管静态文件，不需要任何边缘计算能力。

[来源](wrangler.toml#L1-L3)

---

## 5. `.env` 配置建议

本项目不需要任何构建时或运行时环境变量。

原因：项目是**纯前端 SPA**，所有配置（三条 drand 链的 genesis 时间、period、API 端点等）都硬编码在 `src/chains.js` 中。`drand-client` npm 包的 API 调用也是由浏览器直接发起的，不涉及服务端密钥或环境注入。

`git remote` 显示上游仓库为 `github.com/epheiamoe/drand-draw`，项目中未提供 `.env.example` 文件。如果你 fork 了项目，同样无需处理环境变量——clone 即用。

[来源](src/chains.js) · [来源](git_remote_info)

---

## 6. 部署后验证

部署完成后，访问你的 Pages 域名（如 `https://drand-draw.pages.dev`）。确认以下功能正常：

1. 页面正确加载（`/src/main.js` 已被 Vite 打包为单个 JS 文件）
2. 暗色主题样式生效（Tailwind v4 生成的 CSS 已正确应用）
3. 在「验证」页面输入短码或链接，能正确触发 drand API 调用
4. 在「发起抽奖」页面能生成正确的短码

如果遇到问题，检查 Cloudflare Dashboard 中的构建日志，或者运行 `wrangler pages deployment list` 查看最近的部署状态。

[来源](src/main.js#L1-L150)

---

## 下一步

- 了解项目整体的 **[系统架构全景](系统架构全景.md)**——理解为什么纯前端 SPA 就能支撑可验证抽奖
- 阅读 **[抽奖核心算法](抽奖核心算法.md)**——浏览器端执行的抽奖逻辑与 CLI 版完全一致
- 想了解 drand 网络本身的工作原理？查看 **[drand API 集成与故障切换](drand-api-集成与故障切换.md)**