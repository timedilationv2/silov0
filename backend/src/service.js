
import {
  addPost,
  buildTagIndex,
  filterPosts,
  getArchiveBuckets,
  loadPosts,
  savePosts,
  DEFAULT_POSTS_PATH,
} from "./postsStore.js"

export function createContentService({ storagePath = DEFAULT_POSTS_PATH } = {}) {
  let cache = null

  async function ensureCache() {
    if (!cache) {
      cache = await loadPosts(storagePath)
    }
    return cache
  }

  return {
    async all() {
      return ensureCache()
    },
    async refresh() {
      cache = await loadPosts(storagePath)
      return cache
    },
    async add(postInput) {
      const current = await ensureCache()
      cache = addPost(current, postInput)
      await savePosts(cache, storagePath)
      return cache
    },
    async filter(params) {
      const posts = await ensureCache()
      return filterPosts(posts, params)
    },
    tagIndex() {
      return buildTagIndex(cache || [])
    },
    archives() {
      return getArchiveBuckets(cache || [])
    },
  }
}

export function createApiAdapter(service) {
  return {
    async list(req, res) {
      const data = await service.all()
      res.json(data)
    },
    async filter(req, res, next) {
      try {
        const data = await service.filter({
          tag: req.query.tag,
          query: req.query.q,
        })
        res.json(data)
      } catch (error) {
        next(error)
      }
    },
    async add(req, res, next) {
      try {
        const data = await service.add(req.body)
        res.status(201).json(data)
      } catch (error) {
        next(error)
      }
    },
  }
}
