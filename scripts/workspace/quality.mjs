import { marked } from '../../assets/vendor/marked.esm.js'

export function inlineText(tokens = []) {
  return tokens.map(t => t.tokens ? inlineText(t.tokens) : t.type === 'html' ? '' : t.text || t.raw || '').join('')
    .replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[\da-f]+|\d+);/gi, entity => {
      const known = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }
      if (known[entity]) return known[entity]
      const n = entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
    })
}

export function slug(text) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-') || 'section'
}
export function uniqueSlug(text, seen) {
  const base = slug(text)
  let candidate = base, n = 2
  while (seen.has(candidate)) candidate = `${base}-${n++}`
  seen.add(candidate)
  return candidate
}

// Pure deterministic interface: no UI, storage, or service calls.
// Findings are advisory, except structural errors such as a missing title/broken anchor.
export function reviewDocument(doc) {
  const findings = [], ids = new Set(), headings = [], links = []
  const add = (severity, rule, line, message, explanation) => findings.push({ severity, rule, line, message, explanation })
  if (!doc.title.trim()) add('error', 'title', 0, 'Missing document title', 'A title identifies this document in navigation and exported files.')
  let offset = 0, previousDepth = 0
  const source = doc.content
  const tokens = marked.lexer(source, { gfm: true })
  // Marked supplies block raw text. Locate it for useful line references, including nested blocks.
  function visit(list, start = 0) {
    let cursor = start
    for (const token of list) {
      const index = source.indexOf(token.raw || '', cursor)
      const at = index < 0 ? cursor : index
      const line = source.slice(0, at).split('\n').length
      cursor = at + (token.raw || '').length
      if (token.type === 'heading') {
        const text = inlineText(token.tokens)
        const normalized = slug(text)
        if (!text.trim()) add('error', 'empty-heading', line, 'Empty heading', 'Readers need a meaningful section label.')
        if (headings.some(h => h.normalized === normalized)) add('warning', 'duplicate-heading', line, 'Duplicate heading', 'Repeated labels can make navigation ambiguous; generated anchors remain unique.')
        if (previousDepth && token.depth > previousDepth + 1 || !previousDepth && token.depth > 1) add('warning', 'hierarchy', line, 'Heading level skips a step', 'Consider a sequential hierarchy so the document outline is easier to follow.')
        previousDepth = token.depth
        headings.push({ normalized, depth: token.depth })
        uniqueSlug(text, ids)
      }
      if (token.type === 'code' && !token.text.trim()) add('warning', 'empty-code', line, 'Empty code block', 'An empty example may leave readers without the instruction they need.')
      if (token.type === 'paragraph' && token.text.split(/\s+/).length > 120) add('warning', 'long-paragraph', line, 'Long paragraph (over 120 words)', 'Consider splitting it by reader task. Length is a review prompt, not a correctness judgment.')
      if (token.type !== 'code' && token.type !== 'codespan' && ['paragraph', 'heading', 'text'].includes(token.type) && /\b(?:TODO|TBD|FIXME)\b|\[(?:Describe|Explain|List|Provide|Specify|State|Document|Required|Task name|version|YYYY-MM-DD)/i.test(token.text || '')) {
        add('warning', 'placeholder', line, 'Unresolved placeholder', 'Replace drafting guidance or confirm it is intentional before sharing.')
      }
      // Inline tokens have no block position: the parent line is a useful approximation.
      function inline(items) {
        for (const t of items || []) {
          if (t.type === 'link' && t.href.startsWith('#')) links.push({ href: t.href, line })
          if (t.type === 'image' && !t.text.trim()) add('warning', 'image-alt', line, 'Image has no alt text', 'Describe the information conveyed for readers who cannot view it. Images are not fetched by this workspace.')
          if (t.tokens) inline(t.tokens)
        }
      }
      if (token.type === 'list') for (const item of token.items) visit(item.tokens, at)
      else if (token.type === 'blockquote') visit(token.tokens, at)
      else if (token.type === 'table') {
        for (const cell of [...token.header, ...token.rows.flat()]) inline(cell.tokens)
      } else inline(token.tokens)
    }
  }
  visit(tokens, offset)
  if (source.trim() && !headings.some(h => h.depth === 1)) add('warning', 'h1', 1, 'No level-one heading', 'Consider introducing the document with a top-level heading.')
  for (const link of links) {
    let target
    try { target = decodeURIComponent(link.href.slice(1)) } catch { target = '' }
    if (!ids.has(target)) add('error', 'internal-link', link.line, `Unresolved heading link: ${link.href}`, 'The target does not match a generated heading anchor. Use lowercase words separated by hyphens.')
  }
  return findings.sort((a, b) => a.line - b.line)
}
