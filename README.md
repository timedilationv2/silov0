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
- `index.html` — static entrypoint with search + tag filter.
- `styles.css` — dark, minimal styling tuned for cards.
- `scripts/app.js` — fetches `posts/posts.json` and renders cards with search/filter.
- `posts/posts.json` — editable list of entries (title, date, summary, tags).

## Log
- 2024-12-24: Repo scaffolded; defined scope for AI news micro-blog; added static layout with search/tag filter and sample posts.***
