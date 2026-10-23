import express from "express"
import cors from "cors"
import { createContentService, createApiAdapter } from "./service.js"

export function createApp({ service = createContentService() } = {}) {
  const app = express()
  app.use(cors())
  app.use(express.json())
  const api = createApiAdapter(service)
  app.get("/api/posts", api.list)
  app.get("/api/posts/filter", api.filter)
  app.post("/api/posts", api.add)
  app.get("/health", (_req, res) => res.json({ ok: true }))
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }))
  app.use((error, _req, res, _next) => {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500
    res.status(status).json({ error: status === 500 ? "Internal server error" : error.message })
  })
  return app
}
