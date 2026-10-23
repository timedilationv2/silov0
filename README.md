# SiloV0: portfolio and documentation workspace

The original portfolio, interactive sample library, case study, and API reference
remain on the homepage. **Workspace** in the navigation opens an additional
browser-local Markdown tool at [workspace.html](workspace.html).

The workspace supports technical documentation. Create,
edit, organize, preview, review, reopen, and export documents without an account,
backend server, paid API, or AI key. The workspace does not transmit document
content. It uses IndexedDB on the current browser origin, not the GitHub repository.

## Start using it

Portfolio: <https://timedilationv2.github.io/silov0/>.
Workspace: <https://timedilationv2.github.io/silov0/workspace.html>.
A workspace change reaches that address only after its PR is reviewed and merged
into `main` and the Pages build completes. Development branches are not published.

To run this branch locally, from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://localhost:8000/> for the existing portfolio, or
<http://localhost:8000/workspace.html> for the additional workspace. No npm installation or build is required to use the
site: its two browser libraries are bundled locally in `assets/vendor/`. Use HTTP or
HTTPS, not a `file://` URL. Keep real credentials outside the served directory.

1. Choose **Standard Operating Procedure (SOP)**, then **Create document**.
2. Rename it in **Document title** and replace the template guidance in the editor.
3. Watch the live preview. Wait for **Saved locally** before closing or refreshing.
4. Refresh: the document reopens. Choose it in the sidebar to reopen it later.
5. Select **Export .md** to keep a portable copy. Use **Download JSON backup** to
   keep the whole library in a restorable format.

On a small screen, use the documents menu in the header to create or switch files.

## What works

- Multiple documents with titles, creation/modification timestamps, and optional
  collections. Search titles and filter by collection. Deletion requires confirmation.
- Native multiline Markdown editor with headings, lists, links, code blocks,
  tables, and inline formatting. Native undo/redo, formatting buttons, Ctrl/Cmd+B,
  I, K and S, and Tab indentation. Shift+Tab leaves the editor for keyboard users.
- Live sanitized preview; editor-only, preview-only, or split views. Split stacks
  vertically on mobile. Dark/light theme and last selected document are remembered.
- SOP, API Reference, Troubleshooting Guide, User Guide, and Release Notes templates.
- Autosave after a short pause. Switching documents flushes pending changes;
  storage failures leave the draft in the editor, with retry and recovery export.
- `.md` / `.txt` import, Markdown and standalone sanitized HTML downloads, and
  clipboard copying with an export fallback when permission is denied.
- Validated, versioned JSON backups. Restore asks for confirmation and creates new
  copies with fresh IDs. Matching titles get a suffix; existing content is never replaced.
- Deterministic quality checks for missing titles, empty/duplicate headings,
  heading hierarchy, broken heading links, empty code blocks, missing image alt
  text, drafting placeholders, and long paragraphs. Findings explain their severity
  and jump to an approximate source line. Warnings are review prompts, not objective
  writing judgments. There is no AI assistant or source-grounded Q&A yet.

## Your data and its limits

Documents live only in this browser profile on this origin. Other browsers,
profiles, devices, and local-server ports have separate libraries. Browser data
clearing, private browsing, eviction, or device loss can remove documents. Local
storage is **not synchronization, encryption, or a backup service**. Export backups
regularly and protect downloaded files: they contain complete document text.

Wait for **Saved locally** before leaving. A pending save triggers a browser leave
warning where supported, but a forced process kill can still lose the latest
unsaved keystrokes. A failed save does not replace the saved copy. If another tab
changed a document, the stale save is rejected; use **Save a copy** to keep the
current draft without overwriting the other tab's version. Refresh to load another
tab's saved changes; live collaborative editing is not provided.

Limits: 500 documents; title 200 characters; collection 80; content 1,000,000
characters per document; imported file 2 MB; backup/restore 10 MB. If a combined
backup is too large, export individual Markdown documents or reduce the library
before creating a restorable JSON backup. Restoring copies counts toward the
500-document limit. A backup after a failed save includes the stored version and
an additional unsaved-draft copy when capacity permits; it never silently replaces
one with the other.

Raw HTML is displayed literally; scripts, forms, SVG and active content do not run.
Images are represented by alt-text placeholders and are not fetched, preventing
tracking-image requests. Safe links open only when selected; external links use
`noopener noreferrer`. HTML export also blocks scripts and remote images. Markdown
exports remain raw source and should be rendered safely by other applications.

GitHub Pages project sites under `timedilationv2.github.io` share an origin.
JavaScript from another trusted-or-untrusted project on that same origin could
access browser storage. Avoid storing secrets or highly sensitive material on a
shared origin; an isolated custom domain is a future deployment option.

## Examples / Learn

[index.html](index.html) retains the original portfolio, searchable sample demo,
architecture explanation, API reference, and case study. `learn.html` remains a
compatibility alias for the same page. [samples.html](samples.html)
contains all four original writing samples. The Learn demo still reads
`posts/posts.json` directly; those checked-in examples are separate from authored
workspace documents. The workspace never writes to that file or calls Express.

## Development and tests

Python 3 serves the static files. Node 20+ is needed only for root dependency
maintenance and model tests; the separate backend retains its Node 18+ requirement.

```sh
npm ci
npm test
npm run vendor  # only needed when updating browser libraries
cd backend
npm ci
npm test
```

Browser checks (Playwright and Chromium required):

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/workspace_browser.py
# With the static server running:
python3 tests/demo_smoke.py http://localhost:8000/
python3 tests/security_browser.py http://localhost:8000/
```

The workspace suite starts its own loopback HTTP server and tests under `/silov0/`,
including a persistent-profile browser restart. It uses synthetic test documents,
never an existing user profile. See [testing notes](docs/TESTING.md) for scope and
limits, [architecture](docs/ARCHITECTURE.md) for module boundaries and future AI
interfaces, and [SECURITY.md](SECURITY.md) for protections and remaining risks.

## Quickstart

This optional setup starts the local Express API. The workspace does not need it. The retained API reads/writes the public
example post format, not the IndexedDB workspace library. It binds to loopback;
keep it local and never deploy it as part of GitHub Pages.

```sh
cd backend
npm ci
export API_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
export CORS_ORIGINS=http://localhost:8000
npm run dev
```

Configure a random server-side token of at least 32 bearer-token characters;
missing, short, or placeholder tokens prevent startup. `.env.example` documents
configuration but is not automatically loaded. Never put a real token in browser
code, static files, URLs, logs, or Git. Reads remain public; writes require
`Authorization: Bearer <API_TOKEN>`. Exact configured CORS origins, Helmet,
request-body limits, per-IP rate limits, input validation, locked writes, and
atomic file replacement remain in place.

## API examples

```sh
curl http://localhost:3001/health
# {"ok":true}
curl 'http://localhost:3001/api/posts/filter?tag=reference&q=filter'
```

Response (a plain array, with no wrapper):

```json
[
  {
    "id": "filter-posts",
    "title": "Find posts with the local API",
    "date": "2026-10-23",
    "summary": "Reference: combine an exact topic match with text search to filter local content. Includes parameters, an example response, and empty-result behavior.",
    "tags": ["api", "reference"],
    "url": "samples.html#filter-posts"
  }
]
```

| Route | Behavior |
| --- | --- |
| `GET /api/posts` | All posts, newest date first; ignores query parameters. |
| `GET /api/posts/filter?tag=reference&q=filter` | Exact, case-sensitive tag and case-insensitive text search over title, summary, tags. Both must match; no match returns `[]`. |
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


## GitHub Pages

Pages builds from `main:/`. Keep Jekyll enabled: `_config.yml` excludes backend,
tests, dependency manifests, and configuration from the published output. Browser
modules and local vendor files are static assets using relative paths that work
under `/silov0/`. No writable server is deployed. There is no service worker or
promised offline installation; saved documents survive restarts, but reopening
the app itself requires its static assets to be available.


### Workspace URL and existing documents

The workspace is an additive feature at `workspace.html`, not a replacement for
the portfolio homepage. Moving its HTML entry point does not change the browser
origin, IndexedDB database name, document IDs, or preferences: documents created
with the earlier homepage workspace remain available at the new URL. No export
or migration is needed. No private document content is changed by this routing fix.
