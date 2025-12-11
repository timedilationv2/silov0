import test from "node:test"
import assert from "node:assert/strict"
import {
  createSlug,
  normalizePost,
  filterPosts,
  buildTagIndex,
  getArchiveBuckets,
} from "../src/postsStore.js"

test("createSlug builds a stable slug", () => {
  const slug = createSlug("Deploying 400K context into prod", "2025-01-06")
  assert.equal(slug, "2025-01-06-deploying-400k-context-into-prod")
})

test("normalizePost enforces required fields", () => {
  const post = normalizePost({
    title: "Test",
    date: "2025-01-01",
    summary: "Hello",
    tags: ["models"],
  })
  assert.equal(post.title, "Test")
  assert.deepEqual(post.tags, ["models"])
})

test("filterPosts respects tag and query", () => {
  const sample = [
    {
      id: "1",
      title: "Agentic workflows",
      date: "2025-01-01",
      summary: "support automation",
      tags: ["agents", "ops"],
    },
  ]
  const filtered = filterPosts(sample, { tag: "agents", query: "support" })
  assert.equal(filtered.length, 1)
})

test("buildTagIndex aggregates tag counts", () => {
  const index = buildTagIndex([
    { tags: ["models", "infra"] },
    { tags: ["models"] },
  ])
  assert.equal(index.models, 2)
  assert.equal(index.infra, 1)
})

test("getArchiveBuckets groups by YYYY-MM", () => {
  const buckets = getArchiveBuckets([
    { date: "2025-01-06" },
    { date: "2025-01-02" },
  ])
  assert.equal(buckets[0].label, "2025-01")
  assert.equal(buckets[0].count, 2)
})
