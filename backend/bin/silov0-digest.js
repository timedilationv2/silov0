#!/usr/bin/env node
import { createContentService } from "../src/service.js"

// Keep untrusted content literal when the exported Markdown is rendered.
function markdownText(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]{}()!#]/g, "\\$&")
}

function sourceUrl(value) {
  return value.replace(/[()<>"\\]/g, c => encodeURIComponent(c).replace(/\(/g, "%28").replace(/\)/g, "%29"))
}

async function main() {
  const service = createContentService()
  const posts = await service.all()

  console.log("# silov0 digest (CLI)\n")
  for (const p of posts) {
    console.log(`## ${markdownText(p.title)}`)
    console.log(p.date)
    if (p.tags && p.tags.length) {
      console.log(`_tags: ${p.tags.map(markdownText).join(", " )}_`)
    }
    console.log("")
    console.log(markdownText(p.summary))
    if (p.url) console.log(`[Source](${sourceUrl(p.url)})`)
    console.log("")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
