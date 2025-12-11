import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import { createContentService, createApiAdapter } from "./service.js"

const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(bodyParser.json())

const service = createContentService()
const api = createApiAdapter(service)

// Routes
app.get("/api/posts", api.list)
app.get("/api/posts/filter", api.filter)
app.post("/api/posts", api.add)

// Basic health check
app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`silov0 backend listening on http://localhost:${port}`)
})
