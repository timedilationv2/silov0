import { Marked } from '../../assets/vendor/marked.esm.js'
import DOMPurify from '../../assets/vendor/purify.es.mjs'
import { inlineText, uniqueSlug } from './quality.mjs'

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function safeHref(href) {
  if (!href || /[\u0000-\u0020\u007f]/.test(href)) return false
  try {
    const url = new URL(href, 'https://local.invalid/')
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}

export function renderMarkdown(content) {
  const ids = [], seen = new Set()
  const parser = new Marked({ gfm: true, breaks: false, renderer: {
    html({ text }) { return escape(text) }, // Raw HTML is literal, never executable.
    image({ text }) { return `<span>Image omitted (no network request): ${escape(text || 'no alt text')}</span>` },
    heading({ tokens, depth }) {
      ids.push('doc-' + uniqueSlug(inlineText(tokens), seen))
      return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>`
    },
  } })
  const fragment = DOMPurify.sanitize(parser.parse(content), {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'del', 's', 'blockquote', 'pre', 'code', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'start'], RETURN_DOM_FRAGMENT: true,
  })
  fragment.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading, i) => { heading.id = ids[i] })
  for (const link of fragment.querySelectorAll('a')) {
    const href = link.getAttribute('href') || ''
    if (href.startsWith('#')) link.setAttribute('href', '#doc-' + href.slice(1))
    else if (!safeHref(href)) link.removeAttribute('href')
    else { link.target = '_blank'; link.rel = 'noopener noreferrer' }
  }
  return fragment
}

export function exportHTML(doc) {
  const article = document.createElement('article')
  article.append(renderMarkdown(doc.content))
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(doc.title || 'Untitled document')}</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#182233;overflow-wrap:anywhere}pre{padding:16px;background:#eef2f6;overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #9da9ba;padding:8px}blockquote{border-left:3px solid #8394aa;padding-left:16px}a{color:#174f9e}</style></head><body><header><h1>${escape(doc.title || 'Untitled document')}</h1></header>${article.outerHTML}</body></html>`
}
