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

## Structure
- `index.html` — static entrypoint with search + tag filter.
- `styles.css` — dark, minimal styling tuned for cards.
- `scripts/app.js` — fetches `posts/posts.json` and renders cards with search/filter.
- `posts/posts.json` — editable list of entries (title, date, summary, tags).

## Log
- 2024-12-24: Repo scaffolded; defined scope for AI news micro-blog; added static layout with search/tag filter and sample posts.***
