# silov0

Experimental personal blog-style feed for AI news, notes, and quick posts. This repo tracks the early setup, content ideas, and deployment experiments.

## What this is
- Lightweight news stream for AI updates, personal takes, and link curation.
- Minimal chrome: fast list view, simple post detail, and tags for topics (models, infra, safety, policy).
- Goal: easy publishing over polish; good typography and fast loads.

## Working plan
- Backend: simple JSON/markdown posts first; evaluate a tiny API or static generation later.
- Frontend: lean React or static site generator with markdown ingestion; keep dark/light toggle optional.
- Hosting: start with static deploy (GitHub Pages/Netlify) and upgrade only if needed.
- Content: short posts (150–400 words), tagging by topic, weekly rollups.

## Path to a non-static version
- Start with a tiny Node.js + Express API that serves posts from an array or SQLite file.
- Expose `GET /api/posts` and `GET /api/posts/:id` first; add `POST/PUT` later behind auth for an admin-only editor.
- Deploy the API to a lightweight host (Render/Railway/Fly) and point the frontend fetch call to the hosted URL.
- Keep the existing HTML/CSS/JS; just swap the data source from `posts/posts.json` to the API endpoint when ready.

## Structure
- `index.html` — static entrypoint with search + tag filter, tag cloud, and archive helpers.
- `styles.css` — dark, minimal styling tuned for cards and browse helpers.
- `scripts/app.js` — fetches `posts/posts.json` and renders cards with search/filter, tag counts, and month archive filtering.
- `posts/posts.json` — editable list of entries (title, date, summary, tags).
- `backend/` — publishable Node package with helpers for ingesting, validating, filtering, and exporting posts. The service wrapper keeps storage pluggable so the same logic can back a future API, CLI, or shared library.

## Backend package
The `backend` directory is a tiny, publishable package meant to keep post operations reusable across multiple repos (API service, static site generator, or a shared client library).

- Install dependencies and run tests: `cd backend && npm test` (Node 18+).
- Library entrypoint: `import { createContentService } from "silov0-backend"`.
- Example Express wiring:
  ```js
  import express from "express"
  import bodyParser from "body-parser"
  import { createContentService, createApiAdapter } from "silov0-backend"

  const app = express()
  const service = createContentService()
  const api = createApiAdapter(service)
  app.use(bodyParser.json())
  app.get("/api/posts", api.list)
  app.get("/api/posts/filter", api.filter)
  app.post("/api/posts", api.add)
  ```

This keeps the content model consistent while making it trivial to lift the same logic into API, worker, or library contexts later.

## Log
- 2024-12-24: Repo scaffolded; defined scope for AI news micro-blog; added static layout with search/tag filter and sample posts.***
