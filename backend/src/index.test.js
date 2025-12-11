import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs/promises"
import path from "path"
import { tmpdir } from "os"

import {
  addPost,
  buildTagIndex,
  createContentService,
  createSlug,
  filterPosts,
  getArchiveBuckets,
  loadPosts,
  savePosts,
  DEFAULT_POSTS_PATH,
} from "./index.js"

const samplePosts = [
  {
    id: "alpha",
    title: "Alpha release",
    date: "2024-01-02",
    tags: ["release", "alpha"],
    summary: "Alpha ready",
  },
  {
    id: "beta",
    title: "Beta release",
    date: "2024-02-15",
    tags: ["release", "beta"],
    summary: "Beta ready",
  },
]

function tempFilePath(filename) {
  return path.join(tmpdir(), filename)
}

test("createSlug builds date-aware ids", () => {
  assert.equal(createSlug("Hello World", "2024-05-01"), "2024-05-01-hello-world")
  assert.equal(createSlug("Hello   World!!"), "hello-world")
})

test("addPost prevents duplicates and sorts", () => {
  const updated = addPost(samplePosts, {
    title: "Gamma",
    date: "2024-03-01",
    tags: ["release"],
    summary: "Gamma ready",
  })

  assert.equal(updated[0].id, "2024-03-01-gamma")
  assert.equal(updated.length, 3)

  assert.throws(() => addPost(updated, { id: "alpha", title: "Dup", date: "2024-04-01" }))
})

test("filterPosts handles tag and query filters", () => {
  const filteredByTag = filterPosts(samplePosts, { tag: "alpha" })
  assert.equal(filteredByTag.length, 1)

  const filteredByQuery = filterPosts(samplePosts, { query: "beta" })
  assert.equal(filteredByQuery[0].id, "beta")
})

test("buildTagIndex and archives summarise content", () => {
  const tags = buildTagIndex(samplePosts)
  assert.equal(tags.release, 2)
  assert.equal(tags.alpha, 1)

  const archives = getArchiveBuckets(samplePosts)
  assert.equal(archives[0].label, "2024-02")
  assert.equal(archives[0].count, 1)
})

test("loadPosts reads existing repo data", async () => {
  const posts = await loadPosts(DEFAULT_POSTS_PATH)
  assert.ok(posts.length > 0)
})

test("savePosts writes normalized data", async () => {
  const target = tempFilePath("silov0-posts.json")
  await savePosts(samplePosts, target)
  const output = await fs.readFile(target, "utf8")
  const parsed = JSON.parse(output)

  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].id, "beta")
})

test("content service caches and updates", async () => {
  const target = tempFilePath("silov0-service.json")
  await savePosts(samplePosts, target)

  const service = createContentService({ storagePath: target })

  const first = await service.all()
  assert.equal(first.length, 2)

  await service.add({ title: "Delta", date: "2024-04-04", tags: ["release"] })
  const updated = await service.all()
  assert.equal(updated.length, 3)
  assert.equal(service.tagIndex().release, 3)
})
