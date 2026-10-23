# silov0

A small portfolio sample: a static, filterable feed and a locally runnable Express
API sharing one JSON post format. Sample entries are illustrative, not news reports.

## Quickstart

Requires Python 3 for the static server and Node.js 18+ with npm for the API.
From the repository root:

```sh
python3 -m http.server 8000
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
npm run dev
```

The API listens at <http://localhost:3001>; set `PORT` to change it. The browser
continues to use static JSON. API writes update the same file; reload the page to
see changes. The API caches data: restart it after manually editing JSON.
There is no authentication. Keep this writable API local.

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

There are no single-post, tags, pagination, or bearer-authentication endpoints.

To add a post (this changes `posts/posts.json`; remove the sample afterward if desired):

```sh
curl -i http://localhost:3001/api/posts \
  -H 'Content-Type: application/json' \
  --data '{"id":"quickstart-note","title":"A local note","date":"2024-01-04","summary":"Created through the API.","tags":["docs"],"url":"https://example.com/note"}'
```

The 201 response contains the new post plus existing posts. Repeating the request
returns 409 with `{"error":"Post with id quickstart-note already exists"}`.

A post requires a non-empty string `title` and a real calendar `date` formatted
`YYYY-MM-DD`. Optional: non-empty string `id`, string `summary`, string `url`, and
`tags` containing non-empty strings. Strings are trimmed and tags deduplicated.
An omitted ID is generated from date and title; summary and tags default to `""`
and `[]`. Source URLs are preserved; relative URLs are allowed.

Errors are JSON objects with one `error` string: 400 for invalid bodies, dates,
query types, or malformed JSON; 409 for duplicate IDs; 404 for unknown routes;
413 for oversized bodies; 500 for internal/storage failures (details are hidden).

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
```

It checks both views, counts, empty states, search, tags, and script errors.

## Troubleshooting

- Blank demo or JSON fetch error: use HTTP instead of opening `index.html` as a
  file. Ensure `posts/posts.json` is served with status 200 and contains a JSON array.
- API connection refused: run `npm ci` then `npm run dev` in `backend`, and check
  the port printed in the terminal. The static demo does not need this server.
- POST fails: send `Content-Type: application/json`, a title, and a valid date.
  Use a new ID for each post. Inspect the JSON error response.
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
