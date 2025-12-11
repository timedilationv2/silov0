import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const DEFAULT_POSTS_PATH = path.resolve(
  fileURLToPath(new URL("../../posts/posts.json", import.meta.url))
)

export function createSlug(title = "", date = "") {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return [date, safeTitle].filter(Boolean).join("-").replace(/--+/g, "-")
}

export function normalizePost(post) {
  if (!post || typeof post !== "object") {
    throw new Error("Post must be an object")
  }

  const normalized = {
    id: post.id || createSlug(post.title, post.date),
    title: post.title?.trim() || "Untitled",
    date: post.date,
    summary: post.summary?.trim() || "",
    tags: Array.isArray(post.tags) ? post.tags : [],
  }

  if (!normalized.date) {
    throw new Error("Post is missing a date")
  }

  return normalized
}

export function sortPosts(posts) {
  return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function loadPosts(postsPath = DEFAULT_POSTS_PATH) {
  const raw = await fs.readFile(postsPath, "utf8")
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) return []

  return sortPosts(parsed.map(normalizePost))
}

export async function savePosts(posts, postsPath = DEFAULT_POSTS_PATH) {
  const payload = JSON.stringify(sortPosts(posts).map(normalizePost), null, 2)
  await fs.writeFile(postsPath, `${payload}\n`, "utf8")
}

export function addPost(existingPosts, postInput) {
  const normalized = normalizePost(postInput)
  const ids = new Set(existingPosts.map((p) => p.id))

  if (ids.has(normalized.id)) {
    throw new Error(`Post with id ${normalized.id} already exists`)
  }

  return sortPosts([...existingPosts, normalized])
}

export function filterPosts(posts, { tag, query } = {}) {
  const safeQuery = query?.toLowerCase().trim()
  const selectedTag = tag?.trim()

  return posts.filter((post) => {
    const tags = Array.isArray(post.tags) ? post.tags : []
    const matchesTag = selectedTag ? tags.includes(selectedTag) : true

    const haystack = `${post.title || ""} ${post.summary || ""} ${tags.join(" ")}`
      .toLowerCase()

    const matchesQuery = safeQuery ? haystack.includes(safeQuery) : true

    return matchesTag && matchesQuery
  })
}

export function buildTagIndex(posts) {
  return posts.reduce((acc, post) => {
    const tags = Array.isArray(post.tags) ? post.tags : []
    tags.forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1
    })
    return acc
  }, {})
}

export function getArchiveBuckets(posts) {
  const buckets = new Map()

  posts.forEach((post) => {
    const date = new Date(post.date)
    const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    buckets.set(label, (buckets.get(label) || 0) + 1)
  })

  return [...buckets.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => (a.label < b.label ? 1 : -1))
}

export { DEFAULT_POSTS_PATH }
