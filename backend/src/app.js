import express from "express"
import cors from "cors"
import helmet from "helmet"
import { rateLimit } from "express-rate-limit"
import { createHash, timingSafeEqual } from "node:crypto"
import { PostError } from "./postsStore.js"
import { createContentService, createApiAdapter } from "./service.js"

export function createApp({ service = createContentService(), apiToken = process.env.API_TOKEN,
  allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean),
  apiRateLimit = 300, writeRateLimit = 20, rateWindowMs = 60000 } = {}) {
  if (typeof apiToken !== "string" || apiToken.length < 32 || !/^[A-Za-z0-9._~+/-]+={0,2}$/.test(apiToken) || apiToken.startsWith("REPLACE_")) {
    throw new Error("API_TOKEN must be a non-placeholder bearer token of at least 32 characters")
  }
  if (!Array.isArray(allowedOrigins) || allowedOrigins.some(origin => {
    try { const url = new URL(origin); return !["http:", "https:"].includes(url.protocol) || url.origin !== origin }
    catch { return true }
  })) throw new Error("CORS_ORIGINS must contain exact HTTP(S) origins")
  const expected = createHash("sha256").update(apiToken).digest()
  const app = express()
  app.disable("x-powered-by")
  app.use(helmet())
  const limiter = limit => rateLimit({ windowMs: rateWindowMs, limit, standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: "Too many requests" } })
  app.use("/api", limiter(apiRateLimit))
  const writeLimiter = limiter(writeRateLimit)
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next()
    writeLimiter(req, res, next)
  })
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next()
    const match = /^Bearer ([A-Za-z0-9._~+/-]+={0,2})$/i.exec(req.get("authorization") || "")
    const actual = createHash("sha256").update(match?.[1] || "").digest()
    if (!match || !timingSafeEqual(expected, actual)) {
      res.set("WWW-Authenticate", "Bearer")
      return res.status(401).json({ error: "Unauthorized" })
    }
    next()
  })
  app.use(cors({ origin: allowedOrigins, methods: ["GET", "HEAD", "POST"], allowedHeaders: ["Content-Type", "Authorization"] }))
  app.use(express.json({ limit: "32kb", strict: true }))
  const api = createApiAdapter(service)
  app.get("/api/posts", api.list)
  app.get("/api/posts/filter", api.filter)
  app.post("/api/posts", api.add)
  app.get("/health", (_req, res) => res.json({ ok: true }))
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }))
  app.use((error, _req, res, _next) => {
    if (error instanceof PostError) return res.status(error.status).json({ error: error.message })
    const status = error.type === "entity.too.large" ? 413 :
      ["entity.parse.failed", "request.aborted", "request.size.invalid"].includes(error.type) ? 400 :
      ["encoding.unsupported", "charset.unsupported"].includes(error.type) ? 415 : 500
    res.status(status).json({ error: status === 500 ? "Internal server error" :
      status === 413 ? "Request body too large" : "Invalid request body" })
  })
  return app
}
