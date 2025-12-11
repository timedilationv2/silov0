#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createContentService } from "../src/service.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, "..", "..")

async function main() {
  const postsPath = resolve(__dirname, "../posts/posts.json")
  const raw = await readFile(postsPath, "utf8")
  const data = JSON.parse(raw)

  const service = createContentService({ initialPosts: data })
  const posts = service.list()

  console.log("# silov0 digest (CLI)\n")
  for (const p of posts) {
    console.log(`## ${p.title}`)
    console.log(p.date)
    if (p.tags && p.tags.length) {
      console.log(`_tags: ${p.tags.join(", " )}_`)
    }
    console.log("")
    console.log(p.summary || "")
    console.log("")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
