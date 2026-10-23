# silov0

A small portfolio sample: a static, filterable feed and a locally runnable Express
API sharing one JSON post format. Sample entries are illustrative, not news reports.

## Quickstart

Requires Python 3 for the static server and Node.js 18+ with npm for the API.
From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://localhost:8000/>. “First Demo Post” appears in both the card and table
views. Search `digest` for one result; select `web` for one result or `ai` for two.
Search and tag filters combine. Copy digest exports the currently displayed posts.
The public demo fetches `posts/posts.json` using a relative URL, so GitHub Pages
project hosting works without a backend. Serve this repository root as the site root.

In a separate terminal, start the optional API:

```sh
cd backend
npm ci
npm test
# Generate a token in this terminal; do not copy it into browser code.
export API_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
export CORS_ORIGINS=http://localhost:8000
npm run dev
```

The API listens at <http://localhost:3001>; set `PORT` to change it. The browser
continues to use static JSON. API writes update the same file; reload the page to
see changes. The API caches data: restart it after manually editing JSON.
The server binds only to 127.0.0.1 and refuses to start without a valid API_TOKEN
(at least 32 bearer-token characters). Keep the writable API local; do not deploy it.
`.env.example` documents configuration; `.env` files are ignored and are not loaded
automatically. Never serve a directory containing real secrets with the static server.
CORS_ORIGINS accepts exact comma-separated HTTP(S) origins, with no trailing slash;
unset means no cross-origin browser access. Public GET endpoints require no token.

## API examples

```sh
curl http://localhost:3001/health
# {"ok":true}
curl 'http://localhost:3001/api/posts/filter?tag=ai&q=digest'
```

Response (a plain array, with no wrapper):

```json
[
  {
    "id": "digest-demo",
    "title": "Exporting a Markdown digest",
    "date": "2024-01-02",
    "summary": "Collect filtered AI notes into a Markdown reading list.",
    "tags": ["ai", "docs"]
  }
]
```

| Route | Behavior |
| --- | --- |
| `GET /api/posts` | All posts, newest date first; ignores query parameters. |
| `GET /api/posts/filter?tag=ai&q=digest` | Exact, case-sensitive tag and case-insensitive text search over title, summary, tags. Both must match; no match returns `[]`. |
| `POST /api/posts` | Validates, persists, and returns the full updated array with status 201. |
| `GET /health` | Returns `{"ok":true}`. |

There are no single-post, tags, pagination, or token-issuance endpoints.

To add a post (this changes `posts/posts.json`; remove the sample afterward if desired):

```sh
curl -i http://localhost:3001/api/posts \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_TOKEN" \
  --data '{"id":"quickstart-note","title":"A local note","date":"2024-01-04","summary":"Created through the API.","tags":["docs"],"url":"https://example.com/note"}'
```

The 201 response contains the new post plus existing posts. Repeating the request
returns 409 with `{"error":"Post with id quickstart-note already exists"}`.

A post requires a non-empty string `title` and a real calendar `date` formatted
`YYYY-MM-DD`. Optional: non-empty string `id`, string `summary`, string `url`, and
`tags` containing non-empty strings. Strings are trimmed and tags deduplicated.
An omitted ID is generated from date and title; summary and tags default to `""`
and `[]`. Source URLs are preserved; HTTP(S) and relative URLs are allowed. Other schemes,
embedded credentials, and URL control characters are rejected. Limits (characters):
title 300, summary 10,000, ID 320, URL 2,048; up to 20 tags of 64 characters each.
Writes require `Authorization: Bearer <API_TOKEN>`; missing or invalid tokens return
401. Rotate the token by changing the environment and restarting the server.
Do not put the token in URLs, logs, Git, frontend code, or public static files.

Errors are JSON objects with one `error` string: 400 for invalid bodies, dates,
query types, or malformed JSON; 409 for duplicate IDs; 404 for unknown routes;
401 for unauthorized writes; 413 for bodies over 32 KiB; 429 for rate limits; 500 for internal/storage failures (details are hidden).

## Digest and checks

From the repository root, print a Markdown digest with source links:

```sh
node backend/bin/silov0-digest.js
```

Backend tests cover normalization, file persistence, CLI execution, real HTTP
requests, filtering, and errors. They use temporary storage, leaving demo data intact.

With the static server running, run the browser check:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/demo_smoke.py http://localhost:8000/
python3 tests/security_browser.py http://localhost:8000/
```

It checks both views, counts, empty states, search, tags, and script errors.

## Troubleshooting

- Blank demo or JSON fetch error: use HTTP instead of opening `index.html` as a
  file. Ensure `posts/posts.json` is served with status 200 and contains a JSON array.
- API connection refused: run `npm ci` then `npm run dev` in `backend`, and check
  the port printed in the terminal. The static demo does not need this server.
- POST fails: send `Content-Type: application/json`, a title, and a valid date.
  Use a new ID for each post and the Authorization bearer header. Inspect the JSON error response.
- Manual JSON edits do not appear in API responses: restart the API to clear its cache.
- Clipboard copy fails: use localhost or HTTPS and allow clipboard access.

## Files

- `index.html`, `styles.css`, `scripts/app.js`: static documentation and demo.
- `posts/posts.json`: sample feed shared by the demo, API, and CLI.
- `backend/src/postsStore.js`: normalization, persistence, and filtering helpers.
- `backend/src/service.js`: content service and HTTP adapters.
- `backend/src/app.js`, `backend/src/server.js`: Express app and local server.
- `backend/bin/silov0-digest.js`: Markdown export CLI.

The backend package exports helpers from `@timedilationv2/silov0-backend` and the
service from `@timedilationv2/silov0-backend/service` when installed as a package.


## Security

See [SECURITY.md](SECURITY.md) for protections, verification, compatibility changes,
and operational limits. API requests are limited per IP to 300/minute and writes
to 20/minute (including unauthorized attempts); limit responses use HTTP 429.
Helmet adds API security headers. The separate static host needs its own headers.
The browser never receives the server token and continues reading static JSON.

## GitHub Pages deployment

GitHub Pages publishes the static site from `main:/`. `_config.yml` excludes
backend code, tests and project documentation/configuration from Jekyll output.
Keep Jekyll enabled (do not add `.nojekyll` to main), and never commit secrets.
The public website is https://timedilationv2.github.io/silov0/; Express is not
hosted there. Verify `/backend/src/app.js` and `/.env.example` return 404 after
publication. The separate `gh-pages` branch contains a static-only snapshot;
it is not the configured Pages source.
