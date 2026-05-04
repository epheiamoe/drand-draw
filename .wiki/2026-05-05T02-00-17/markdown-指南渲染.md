# Markdown 指南渲染

使用说明页面是应用内篇幅最长的内容，承载了完整的抽奖流程说明与算法规范。它不需要与用户高频交互，但**必须支持中英文即时切换**。为此，系统设计了一套基于运行时预取与行级解析的渲染管线。

---

## 架构总览

```
应用启动
    │
    ▼
preFetchMd() ──── 并行 fetch ──→  /GUIDE.md
    │                              /GUIDE_EN.md
    ▼
mdCache { '/GUIDE.md': str, '/GUIDE_EN.md': str }
    │
    ▼ (用户切换到 Guide 标签页)
renderGuide(container)
    │
    ├── getLang() → 选择 mdFile 路径
    ├── getCachedMd(lang) → 从 mdCache 读文本
    └── mdToHtml(md) → 行级解析 → 拼接 HTML
          │
          └── 注入 container.innerHTML
```

三个核心函数构成一条从网络到 DOM 的流水线，任何一步失败都有兜底行为。

[来源](src/markdown.js#L1-L47)

---

## 预取策略：`preFetchMd`

`preFetchMd` 在 `main.js` 的应用入口处被无等待调用：

```js
preFetchMd()
```

内部实现使用 `Promise.all` 并行请求 `/GUIDE.md` 和 `/GUIDE_EN.md`，结果存入模块级闭包对象 `mdCache`：

```js
const mdCache = {}

export async function preFetchMd() {
  const files = ['/GUIDE.md', '/GUIDE_EN.md']
  await Promise.all(files.map(async (f) => {
    try {
      const res = await fetch(f)
      if (res.ok) mdCache[f] = await res.text()
    } catch { /* ignore */ }
  }))
}
```

两个设计细节值得注意：

- **静默容错** — `try/catch` 捕获所有网络异常，不抛出也不阻塞应用初始化。即使预取失败，页面其他功能（发起抽奖、验证）完全不受影响。
- **路径约定** — 文件放在 `public/` 目录，Vite 构建时直接复制到 `dist/` 同路径，使得运行时可以通过相对根路径 `/GUIDE.md` 直接 fetch。`public/GUIDE.md` 和 `public/GUIDE_EN.md` 是两份独立的源文件，并非同一文件的不同语言版本。

[来源](src/markdown.js#L1-L14) · [来源](src/main.js#L17)

---

## 缓存读取：`getCachedMd`

```js
export function getCachedMd(lang) {
  const key = lang === 'en' ? '/GUIDE_EN.md' : '/GUIDE.md'
  return mdCache[key] || null
}
```

`lang` 参数来自 [国际化实现](国际化实现.md) 中的 `getLang()`，取值 `'zh'` 或 `'en'`。根据语言映射到对应的 URL 路径键名。如果预取尚未完成或请求失败，返回 `null`。

调用者负责处理 `null` 场景。`Guide` 组件正是通过这个 `null` 判断来决定是渲染内容还是降级显示。

[来源](src/markdown.js#L4-L7)

---

## Markdown 转 HTML：`mdToHtml`

`mdToHtml` 是一个**自实现的轻量级行级解析器**，而非依赖 `marked.js`、`marked` 或 `showdown` 等外部库。这样做有明确的理由：输出 HTML 需要精确控制每个元素的 Tailwind CSS 类名，以匹配应用的深色主题视觉风格。

### 解析架构

```
mdToHtml(md)
    │
    ├── split('\n') → lines[]
    │
    └── 逐行扫描，通过模式匹配分发到子解析器
         │
         ├── parseCodeBlock()   ─── fenced ``` code
         ├── parseTable()       ─── pipe table
         ├── parseHeader()      ─── # ~ ####
         ├── parseBlockquote()  ─── >
         ├── parseUnorderedList() ─── -
         ├── parseOrderedList()   ─── 1.
         └── parseParagraph()    ─── fallback
```

每个子解析器返回一个结构 `{ html, nextIndex }`，主循环从中获取 HTML 片段并跳过已处理的行。这种"消费式"扫描避免了回溯，时间复杂度为 **O(n)**。

### 内联格式化

行内样式通过 `inlineFormat()` 函数处理，依次执行三次正则替换：

| 语法 | 正则 | 输出 |
|------|------|------|
| `` `code` `` | `` /`([^`]+)`/g `` | `<code class="text-sm bg-gray-800 px-1 rounded">` |
| `**bold**` | `/\*\*([^*]+)\*\*/g` | `<strong>` |
| `[text](url)` | `/\[([^\]]+)\]\(([^)]+)\)/g` | `<a href="..." target="_blank" rel="noopener" class="text-blue-400 ...">` |

替换顺序经过考量：code 优先，避免反引号内的 `**` 或 `[]()` 被误解析。链接标记 `target="_blank"` 和 `rel="noopener"` 硬编码，确保在 SPA 环境中安全打开外部链接。

### 块级解析器特点

**代码块**：支持语言标识（` ```python `）但不做语法高亮，仅用 `escapeHtml` 转义后包裹 `<pre><code>`。**表格**：校验分隔行（`|---|`），要求表头与单元格数严格一致，确保格式异常时不产生碎片输出。**标题**：只处理 `h1` 到 `h4`（`#` 到 `####`），`h5+` 视作普通段落。**引用/列表**：连续行合并为一个块元素。

[来源](src/markdown.js#L16-L127)

---

## Guide 组件：`renderGuide`

```js
export function renderGuide(container) {
  const lang = getLang()
  const mdFile = lang === 'en' ? '/GUIDE_EN.md' : '/GUIDE.md'
  const md = getCachedMd(lang)

  if (!md) {
    container.innerHTML = `<div class="..."><a href="${mdFile}" ...>View guide</a></div>`
    return
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
      ${mdToHtml(md)}
      <p class="text-xs text-gray-600 text-center pt-4">
        <a href="${mdFile}" target="_blank" ...>${lang === 'en' ? 'View raw markdown' : '查看原始 Markdown'}</a>
      </p>
    </div>
  `
}
```

组件的行为可以概括为"三态"：

| 状态 | 条件 | 表现 |
|------|------|------|
| **已缓存** | `md !== null` | 渲染 Markdown 并附加"查看原始"链接 |
| **未缓存** | `md === null` | 降级为纯链接，指向原始 .md 文件 |
| **语言切换** | `renderGuide` 再次被调用 | 重新选择文件路径，重新解析 |

[来源](src/components/Guide.js#L1-L24)

---

## 为什么需要运行时渲染

最直接的问题：为什么不把 `GUIDE.md` 编译成静态 HTML 直接嵌入？答案是**运行时语言切换**。

[国际化实现](国际化实现.md) 中的 `setLang()` 会在用户点击语言切换按钮后触发全局重新渲染：

```js
app.querySelector('#lang-switch').addEventListener('click', () => {
  const newLang = getLang() === 'zh' ? 'en' : 'zh'
  setLang(newLang)
  render()  // 重新渲染所有组件
})
```

当 `render()` 执行到 `hash === '/guide'` 分支时，`renderGuide(mainContent)` 被再次调用。此时 `getLang()` 返回的是新语言值，`getCachedMd` 选择不同的缓存键，`mdToHtml` 处理不同的源文本。**整个过程不需要重新 fetch，因为两个版本在启动时已被并行预取。**

对比两种方案：

| 方案 | 语言切换 | 构建复杂度 | 文件体积 |
|------|----------|------------|----------|
| **运行时渲染** | 切换后即刻解析另一个文件 | 零构建配置 | 两篇 Markdown + 解析器 |
| **静态 HTML** | 需要两套 HTML 或 JS 动态替换 | 需额外构建步骤或手动维护 | 两篇 HTML |
| **SSR/预渲染** | 需重新 hydration | 需集成 SSR 框架 | 团队成本 |

运行时渲染在这个场景下的优势在于：解析器代码仅约 130 行，两个 Markdown 文件合计不到 40KB，而换来的是一致的渲染样式、零构建耦合、以及对未来多语言扩展的天然支持。

[来源](src/main.js#L72-L79) · [来源](src/markdown.js#L16-L127)

---

## 安全考量

- **XSS 防御** — `mdToHtml` 的唯一数据来源是预取的 Markdown 文件（与应用同源），本身没有用户输入注入的风险。但 `inlineFormat` 中的 `escapeHtml` 在代码块解析中被调用，确保任何 Markdown 文件内的 `<script>` 标签不会被原样传递。
- **降级不泄露** — 缓存未命中时只显示一个指向原始 Markdown 文件的链接，文件由 Cloudflare Pages 托管，不涉及服务端渲染。

[来源](src/markdown.js#L53-L56)

---

## 下一步

- 查看 [SPA 路由与页面三态](spa-路由与页面三态.md) 了解 `renderGuide` 是如何被路由系统触发的
- 查看 [国际化实现](国际化实现.md) 了解语言检测与切换机制
- 查看 [Lucide 图标系统](lucide-图标系统.md) 了解与渲染管线配合的图标方案