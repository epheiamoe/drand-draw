# Lucide 图标系统

在 drand-draw 项目中，所有图标都来自 [Lucide](https://lucide.dev) 开源图标库。与常见的图标字体或 CDN 图片方案不同，本项目采用 **纯内联 SVG 字符串** 的方式管理图标，将其作为一等公民嵌入 JavaScript 模块。

## 设计：从工厂函数到命名导出

整份图标定义集中在一个文件 `src/icons.js` 中，核心是一个工厂函数：

```js
function icon(paths, extra) {
  const e = extra || ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
    viewBox="0 0 24 24" fill="none" stroke="currentColor" 
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
    class="lucide" ${e}>${paths}</svg>`
}
```

该函数接受两个参数：

- **`paths`** — Lucide 图标的 `<path>`、`<circle>`、`<rect>` 等内部元素的 HTML 字符串；
- **`extra`**（可选）— 追加到 `<svg>` 标签上的自定义属性，例如 `class="my-icon"` 或 `style="..."`。

每个图标通过调用 `icon()` 生成完整 SVG 字符串，再以命名键挂在 **`ICONS`** 对象上导出：

```js
export const ICONS = {
  dices: icon(`<rect width="12" height="12" x="2" y="10" ... /><path d="..." />`),
  shieldCheck: icon(`<path d="M20 13c0 5..." /><path d="m9 12 2 2 4-4" />`),
  clock: icon(`<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />`),
  // ...
}
```

[来源](src/icons.js#L1-L12)

## 为什么选择内联 SVG

**零额外网络请求**。图标以字符串形式打包在 JS bundle 中，浏览器加载 JavaScript 的同时就得到了所有图标，无需额外的 CSS 字体文件下载或 CDN 请求。这对单页应用尤为关键——首屏渲染不依赖任何外部资源。

**按需加载，Tree-shakable**。`ICONS` 对象是 ES Module 命名导出，构建工具（Vite/Rollup）可以静态分析出哪些图标被实际引用。如果某个页面只用到 `dices` 和 `check` 两个图标，其余图标的字符串就不会出现在生产代码中。

**颜色即继承**。所有 SVG 的 stroke 都设置为 `currentColor`，这意味着图标的颜色完全由 CSS 继承决定——父元素的 `color` 属性可以直接控制图标颜色，无需为每种颜色预定义变体。在组件中常见这样的用法：

```html
<span class="text-gray-400">${ICONS.search}</span>
<span class="text-blue-400">${ICONS.shieldCheck}</span>
```

同一个 `ICONS.search` 字符串，在不同容器中渲染出不同颜色。

**方便自定义与动画**。内联 SVG 是 DOM 的一部分，可以直接通过 CSS 或 JavaScript 操作内部的 path 元素，实现旋转、描边动画等效果。图标字体无法做到这一点。

[来源](src/icons.js#L4-L6)

## 使用模式

图标在组件中以模板字符串方式直接嵌入 HTML：

```js
import { ICONS } from '../icons.js'

// 在 innerHTML 赋值中
btn.innerHTML = `${ICONS.dices} ${t('drawBtn')}`
```

从 `src/components/CreateDraw.js`、`src/components/DrawStatus.js`、`src/components/SortTool.js` 和 `src/main.js` 的引用可以看出，总计约 20 个不同图标分散在 UI 各处——从骰子图标（抽奖按钮）、盾牌勾（验证成功）、到复制、搜索、警告三角形等。

[来源](src/components/CreateDraw.js#L6) [来源](src/components/DrawStatus.js#L6) [来源](src/components/SortTool.js#L2) [来源](src/main.js#L7)

## 扩展：添加新图标

添加一个新图标只需两步：

1. 从 [lucide.dev/icons](https://lucide.dev/icons) 找到目标图标，复制其 SVG path 内容（只需 `<svg>...</svg>` 内部的部分）；
2. 在 `src/icons.js` 的 `ICONS` 对象中追加一条记录：

```js
export const ICONS = {
  // ... 已有图标
  heart: icon(`<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 12 5.5 5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />`),
}
```

**命名约定**：键名使用 **camelCase**，与 Lucide 官方名称对应。例如 `shield-check` 对应 `shieldCheck`，`external-link` 对应 `externalLink`。注意 `x` 图标因与 JSX 的 `x` 标签冲突，命名为 `xIcon`。

**回退模式**：`SortTool.js` 展示了一个有趣的设计模式——某些图标尚未添加进 `ICONS` 时，代码使用 `||` 提供回退：

```js
${ICONS.listChecks || ICONS.chevronDown}
${ICONS.grid3x3 || ICONS.chevronDown}
```

这意味着如果将来 `listChecks` 或 `grid3x3` 被添加到 `ICONS` 中，这些位置会自动使用正确的图标；在此之前，它们以 `chevronDown` 作为视觉占位。这是渐进式增强的轻量实现，无需修改组件代码。

[来源](src/icons.js#L1-L6) [来源](src/icons.js#L7-L30) [来源](src/components/SortTool.js#L41-L44)

## ❖ 图标清单一览

| 键名 | 对应 Lucide 名称 | 用途场景 |
|------|-----------------|---------|
| `dices` | dices | 抽奖按钮、站点标题 |
| `shieldCheck` | shield-check | 验证成功结果 |
| `clock` | clock | 状态：未开始 / 已过期 |
| `copy` | copy | 复制链接、复制代码 |
| `globe` | globe | 语言切换按钮 |
| `info` | info | 信息提示 |
| `check` | check | 操作成功反馈 |
| `xIcon` | x | 关闭按钮、验证失败 |
| `users` | users | 参与者相关 |
| `trophy` | trophy | 奖项与结果 |
| `chevronDown` | chevron-down | 下拉箭头 |
| `chevronLeft` | chevron-left | 返回/收起 |
| `search` | search | 搜索输入框 |
| `hash` | hash | 哈希值显示 |
| `link` | link | 链接图标 |
| `externalLink` | external-link | 外部链接（如 GitHub） |
| `alertTriangle` | alert-triangle | 验证失败警告 |
| `refreshCw` | refresh-cw | 加载/重试状态 |
| `partyPopper` | party-popper | 抽奖结果庆祝 |
| `wallet` | wallet | 钱包相关 |
| `mousePointerClick` | mouse-pointer-click | 点击操作引导 |
| `qrCode` | qr-code | 二维码展示 |

[来源](src/icons.js#L7-L30)

## 设计原则总结

- **集中管理**：所有图标定义在一个文件中，新增、删除、修改一目了然。
- **无外部依赖**：不依赖图标字体、CDN 或 SVG sprite。
- **CSS 可控**：颜色通过 `currentColor` 继承，样式通过 `class="lucide"` 统一控制。
- **渐进增强**：通过 `||` 回退模式允许图标分阶段添加，组件代码无需等待图标就绪。

---

**推荐阅读**：[国际化实现](国际化实现.md) 解释了与图标配合使用的翻译系统；[SPA 路由与页面三态](spa-路由与页面三态.md) 展示了图标如何在单页应用的不同状态间切换时保持一致的视觉表现。