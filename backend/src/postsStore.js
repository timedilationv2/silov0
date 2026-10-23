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

export class PostError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function normalizePost(post) {
  if (!post || typeof post !== "object" || Array.isArray(post)) {
    throw new PostError("Post must be an object")
  }
  if (typeof post.title !== "string" || !post.title.trim()) {
    throw new PostError("title must be a non-empty string")
  }
  if (typeof post.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(post.date) ||
      !Number.isFinite(Date.parse(post.date)) ||
      new Date(post.date).toISOString().slice(0, 10) !== post.date) {
    throw new PostError("date must be a valid calendar date (YYYY-MM-DD)")
  }
  for (const field of ["id", "summary", "url"]) {
    if (post[field] !== undefined && typeof post[field] !== "string") {
      throw new PostError(`${field} must be a string`)
    }
  }
  if (post.id !== undefined && !post.id.trim()) {
    throw new PostError("id must be a non-empty string")
  }
  if (post.tags !== undefined && (!Array.isArray(post.tags) ||
      post.tags.some(tag => typeof tag !== "string" || !tag.trim()))) {
    throw new PostError("tags must be an array of non-empty strings")
  }
  return {
    id: post.id?.trim() || createSlug(post.title.trim(), post.date),
    title: post.title.trim(),
    date: post.date,
    summary: post.summary?.trim() || "",
    tags: [...new Set((post.tags || []).map(tag => tag.trim()))],
    ...(post.url !== undefined ? { url: post.url.trim() } : {}),
  }
}

export function sortPosts(posts) {
  return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function loadPosts(postsPath = DEFAULT_POSTS_PATH) {
  const raw = await fs.readFile(postsPath, "utf8")
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) throw new Error("Posts file must contain an array")

  try {
    return sortPosts(parsed.map(normalizePost))
  } catch (error) {
    // Invalid stored data is a server failure, not a bad HTTP request.
    throw new Error("Invalid post data in storage", { cause: error })
  }
}

export async function savePosts(posts, postsPath = DEFAULT_POSTS_PATH) {
  const payload = JSON.stringify(sortPosts(posts).map(normalizePost), null, 2)
  await fs.writeFile(postsPath, `${payload}\n`, "utf8")
}

export function addPost(existingPosts, postInput) {
  const normalized = normalizePost(postInput)
  const ids = new Set(existingPosts.map((p) => p.id))

  if (ids.has(normalized.id)) {
    throw new PostError(`Post with id ${normalized.id} already exists`, 409)
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
