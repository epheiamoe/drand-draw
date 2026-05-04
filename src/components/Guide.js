import { getLang } from '../i18n.js'
import { mdToHtml, getCachedMd } from '../markdown.js'

export function renderGuide(container) {
  const lang = getLang()
  const mdFile = lang === 'en' ? '/GUIDE_EN.md' : '/GUIDE.md'
  const md = getCachedMd(lang)

  if (!md) {
    container.innerHTML = `<div class="max-w-3xl mx-auto text-center py-10 text-gray-400"><a href="${mdFile}" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">View guide</a></div>`
    return
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
      ${mdToHtml(md)}
      <p class="text-xs text-gray-600 text-center pt-4">
        <a href="${mdFile}" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">${lang === 'en' ? 'View raw markdown' : '查看原始 Markdown'}</a>
      </p>
    </div>
  `
}
