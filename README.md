# SiloV

SiloV combines a browser-based Markdown editor, a searchable collection of documentation examples, and an optional local API for managing sample metadata.

- [Overview](https://timedilationv2.github.io/silov0/)
- [Workspace](https://timedilationv2.github.io/silov0/workspace.html)
- [Documentation](https://timedilationv2.github.io/silov0/documentation.html)

The links describe the intended published routes. Source changes appear on the live site only after a successful Pages deployment.

## Three components

**Writing workspace:** draft, preview, review, organize, import, and export Markdown. Documents stay in this browser profile on this origin. The editor does not call the API or write to the checkout.

**Documentation examples:** four finished writing samples in `samples.html`. The searchable collection reads titles, summaries, dates, tags, and links from `posts/posts.json`. The JSON is metadata, not full article prose. The documentation hub separates these samples from instructions for operating the workspace.

**Optional local API:** Express reads and adds entries to `posts/posts.json` in a local checkout. It does not edit the full articles, access browser documents, or publish changes. Publishing requires a separate source review and deployment.

```text
workspace.html → scripts/workspace/ ↔ browser document library → exports

documentation.html → scripts/app.js → posts/posts.json → links to samples.html
                                                ↕
                              local client ↔ optional Express API
```

## Run the site

Python 3 is sufficient. No npm install, build, account, API key, or backend is required to use the site; Marked and DOMPurify are bundled locally.

```sh
git clone https://github.com/timedilationv2/silov0.git
cd silov0
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000/`, then choose Workspace or Documentation. Use HTTP rather than `file://`. Keep credentials outside the served directory. Stop the server with Ctrl+C.

## Repository structure

```text
index.html                   Project overview
workspace.html               Stable writing workspace entry point
workspace.css                Editor layout
styles.css                   Shared visual system
scripts/site.js              Shared theme and legacy link handling
documentation.html           Documentation hub and searchable examples
using-workspace.html         Editor usage, review, export, and recovery
running.html                 Setup, repository structure, architecture
api.html                     Optional API operating guide
samples.html                 Full tutorial, reference, troubleshooting, how-to
learn.html                   Compatibility alias for the documentation hub
history.html                 Optional development background
scripts/workspace/           UI, model, storage, templates, example, rendering, review
scripts/app.js               Example search, filters, digest export
posts/posts.json             Example metadata and article links
assets/vendor/               Bundled browser libraries and licenses
backend/src/                 Express routes, service, and JSON store
backend/bin/silov0-digest.js  CLI export of sample summaries
backend/test/                API, validation, security, concurrency tests
tests/                       Model and browser regression tests
docs/                        Architecture and testing notes
SECURITY.md                  Security model and limitations
_config.yml                  GitHub Pages exclusions
```

## Writing and storage

Choose **New document**, select a template, and create it. An empty library also offers **Open a realistic example**; that explicit action creates a new editable copy. Reloading does not add copies. Rename using Document title; edits autosave. Wait for **Saved locally** before leaving.

Use Editor, Split, or Preview, **Review** for structural findings, and **Download .md** for a portable copy. Document options contains collection assignment, Markdown copying, HTML export, and deletion. Library options contains import, collection filtering, backup, and restore. See the [workspace guide](https://timedilationv2.github.io/silov0/using-workspace.html).

The database remains `silov0-workspace`, version 1, object store `documents`. Its name, schema, document IDs, origin, and `workspace.html` route are unchanged by this restructuring. Documents saved under the former homepage entry point remain accessible on the same origin. Theme, view, and active-document preferences retain their existing `silov0-` localStorage keys.

There is no synchronization, encryption, automatic backup, or automatic publishing. Clearing browser data, private sessions, eviction, or device loss can remove documents. Browsers, profiles, domains, and ports have separate libraries. GitHub Pages projects on the same hostname share an origin, so avoid highly sensitive material there.

Download JSON backups regularly and protect them: they contain full text. Restore validates a version 1 backup and creates new copies with new IDs, preserving existing documents. Limits are 500 documents, 200 title characters, 80 collection characters, 1,000,000 content characters per document, 2 MB per imported file, and 10 MB per backup/restore.

A failed save retains the draft for retry or Markdown recovery. A stale tab cannot overwrite another tab’s newer revision; **Save a copy** preserves both versions. There is no live collaboration. Forced closure before save completion can lose recent edits. Markdown preview and HTML export sanitize content; raw HTML is literal and images are omitted. Review findings check structure, not facts or completeness.

## Optional API setup

Requires Node 18+ (use Node 20+ for the whole repository). From the repository root:

```sh
cd backend
npm ci
export API_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
export CORS_ORIGINS=http://localhost:8000
npm run dev
```

The server binds to `127.0.0.1:3001`; `PORT` overrides the port. A non-placeholder token of at least 32 accepted bearer-token characters is required even for read-only startup. `.env.example` documents settings but is not automatically loaded. Never put real tokens in browser code, URLs, logs, or Git.

```sh
curl http://localhost:3001/health
# {"ok":true}
curl 'http://localhost:3001/api/posts/filter?tag=reference&q=filter'
```

| Route                   | Behavior                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/posts`        | All entries, newest first; ignores query parameters.                                                                       |
| `GET /api/posts/filter` | Exact, case-sensitive `tag`; case-insensitive `q` across title, summary, and tags. Both must match; no match returns `[]`. |
| `POST /api/posts`       | Requires bearer authentication. Adds an entry to local JSON and returns 201 with the updated array.                        |
| `GET /health`           | Returns `{"ok":true}`.                                                                                                     |

Writes require `Authorization: Bearer <API_TOKEN>`, a nonempty title, and a real `YYYY-MM-DD` date. Optional fields: `id`, `summary`, `tags`, `url`. Errors use `{"error":"message"}`. See [Local API](https://timedilationv2.github.io/silov0/api.html) for limits, error codes, and a write example; [backend/README.md](backend/README.md) and [SECURITY.md](SECURITY.md) contain additional context.

Reads are cached; restart after manual JSON edits. Writes use locking and atomic file replacement. The API is not hosted by GitHub Pages. Adding metadata does not create a sample article or deploy anything. The CLI `node backend/bin/silov0-digest.js` exports all sample summaries without starting Express.

## Development and tests

Root dependencies require Node 20+. Use the lockfiles; no compilation step is needed. `npm run vendor` is only for intentional browser-library updates.

```sh
npm ci
npm test
(cd backend && npm ci && npm test)
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/workspace_browser.py
# In another terminal, with the static server running:
python3 tests/demo_smoke.py http://localhost:8000/
python3 tests/security_browser.py http://localhost:8000/
python3 tests/site_browser.py http://localhost:8000/
```

To use a system Chromium instead of Playwright’s downloaded browser, prefix browser commands with `SILOV_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. Platform browser libraries are required.

- Root tests: document/backup validation, template structures, review findings.
- Backend tests: API responses, authentication, CORS, limits, validation, concurrent writes, storage failures, and sample-reference accuracy. Writes use temporary fixtures.
- Workspace browser suite: creation, templates and example copies, editing, renaming, persistence across reload/browser restart, legacy stored documents, preview, review, import/export, backup/restore, conflicts, recovery, responsive layout, and malicious content.
- Example smoke suite: static JSON loading, search/filter, summary/table views, digest copy and failures, and sample links.
- Security browser suite: hostile sample metadata remains text; unsafe links are omitted.
- Site browser suite: shared navigation/theme, internal links and fragments, legacy routes, keyboard entry, mobile layout, and screenshots.

See [docs/TESTING.md](docs/TESTING.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [SECURITY.md](SECURITY.md). Only Chromium is covered automatically; other browsers, assistive technologies, device hardware, eviction policies, and power-loss behavior need separate validation.

## Deployment

GitHub Pages is configured for `main:/`. `_config.yml` excludes the backend, tests, manifests, and configuration from the generated static site. No writable API is deployed. `learn.html`, sample fragments, and former landing-page section links retain compatibility paths. Publishing this restructuring and verifying the live deployment are separate from local implementation and testing.
