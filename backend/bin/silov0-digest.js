#!/usr/bin/env node
import { createContentService } from "../src/service.js"

async function main() {
  const service = createContentService()
  const posts = await service.all()

  console.log("# silov0 digest (CLI)\n")
  for (const p of posts) {
    console.log(`## ${p.title}`)
    console.log(p.date)
    if (p.tags && p.tags.length) {
      console.log(`_tags: ${p.tags.join(", " )}_`)
    }
    console.log("")
    console.log(p.summary || "")
    if (p.url) console.log(`[Source](${p.url})`)
    console.log("")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
