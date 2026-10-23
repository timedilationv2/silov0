# SiloV

SiloV combines a browser-based technical-documentation editor, a searchable collection of documentation examples, and an optional local API for managing sample metadata.

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
scripts/workspace/           UI, editors, typed storage, templates, rendering, validation
scripts/app.js               Example search, filters, digest export
posts/posts.json             Example metadata and article links
assets/vendor/               Bundled editor libraries, XML worker/WASM, licenses
assets/schemas/              Supported release-manifest XSD
backend/src/                 Express routes, service, and JSON store
backend/bin/silov0-digest.js  CLI export of sample summaries
backend/test/                API, validation, security, concurrency tests
tests/                       Model and browser regression tests
docs/                        Architecture and testing notes
SECURITY.md                  Security model and limitations
_config.yml                  GitHub Pages exclusions
```

## Editors, templates, and storage

Choose **New document → document type → blank or template**. Templates create independent editable copies; reloading never creates duplicates. The right document panel provides outline, separate adaptation guidance, and validation findings. Saving locally, downloading, and publishing are distinct; the editor never publishes your documents.

| Editor      | Implemented authoring capabilities                                                                                                                                                                                                 | Native export               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Visual HTML | Tiptap/ProseMirror selection-based bold/italic/underline/code, paragraphs/headings, nested lists, links, quotes, code blocks, tables with row/column editing, local images with alt text, undo/redo, find/replace, heading outline | `.html`                     |
| Markdown    | CodeMirror highlighted GFM-subset source, indentation/list continuation, formatting shortcuts, history, folding, find/replace, synchronized preview, line diagnostics, outline                                                     | `.md`; one-way reading HTML |
| XML         | CodeMirror highlighting, matching/closing tags, completion, indentation, folding, search/replace, source outline, libxml2 well-formedness checks, bundled release-manifest XSD validation                                          | `.xml`                      |
| DITA        | DITA 1.3 concept/task/reference source, outline, permitted-child completion/insertion, required element/order/structure checks                                                                                                     | `.dita`                     |

Libraries are maintained open-source components: Tiptap/ProseMirror, CodeMirror 6/Lezer, prosemirror-search, and xmllint-wasm/libxml2 are MIT licensed. Marked parses Markdown; DOMPurify sanitizes rendering/imports. Runtime assets, WASM, the supported XSD, and license notices are bundled locally. See [docs/EDITORS.md](docs/EDITORS.md) for exact contracts and [assets/vendor/NOTICES.txt](assets/vendor/NOTICES.txt) for notices. The lockfile pins installed versions.

The Markdown dialect supports headings, emphasis, strike, code, quotes, lists, safe links, and GFM tables. Raw HTML remains literal and remote images are omitted. Task-list source is preserved without interactive preview checkboxes. Visual HTML supports a richer schema, so there is **no automatic visual↔Markdown conversion**. HTML import warns about normalization and retains the complete original source separately for download and backup. No Microsoft Word/DOCX compatibility, arbitrary CSS preservation, or lossless general HTML↔Markdown round trip is claimed.

XML import accepts UTF-8. Source editing/export keeps document structure and uses LF line endings after edits. XML schema validation is real libxml2 XSD validation, explicitly limited to `assets/schemas/release-manifest.xsd` (Documentation release manifest 1.0). Otherwise XML receives well-formedness checks only. DTD/entity declarations are blocked, and no external entities, schemas, XInclude, stylesheets, or references are resolved.

DITA support targets a documented **DITA 1.3 topic subset**, not the complete OASIS grammar. Custom checks cover supported children/attributes, topic IDs, required title/body, ordering, task steps/commands, unique IDs, and nonempty structures. Full OASIS grammar validation, maps, specialization, domains, conref/keyref, conditional processing, reference resolution, and DITA-OT publishing require an external toolchain and are not claimed here. Source outside the supported subset remains editable/exportable and receives unsupported-structure findings.

The nine worked templates are: SOP (staging key rotation), API reference (a fictional Harbor Queue operation with coherent request/response), troubleshooting (stalled worker), user guide (documentation review), release notes (fictional Harbor 1.4), DITA concept, DITA task, DITA reference, and XML documentation release manifest. Each has audience, purpose, and adaptation guidance outside exportable content. The five prose templates can initialize Markdown or visual copies. Harbor's API and dashboard are fictional and are not SiloV functionality.

The stable `workspace.html` route and `silov0-workspace` IndexedDB database name remain. Version 2 adds a `legacy-v1` archive of original version 1 records without rewriting them. Existing documents open as Markdown with original IDs, source, names, timestamps, collection, and revision. Normal edits save typed version 2 records. Theme/view/active-document preference keys remain unchanged.

Version 2 JSON backups include every document type, source, schema choice, template reference, and retained original HTML. Restore accepts version 1 and 2 backups and creates fresh-ID copies atomically, never overwriting documents. Stale-tab revision conflicts offer **Save a copy**. Storage failures retain the draft with retry and native recovery downloads; failed-save backups include a separate unsaved copy when capacity permits. Wait for **Saved locally** before leaving. Forced closure before commit can still lose recent edits.

Limits: 500 documents, 200 name characters, 80 collection characters, 1,000,000 content characters per document, 2 MB per import, 10 MB per backup/restore. Original imported HTML is separately capped at 1,000,000 characters. Visual images require alt text and must be PNG/JPEG/WebP up to 200 KB, maximum three per document; base64 data counts toward document and backup caps. There is no sync, encryption, automatic backup, or automatic publishing. Browser/profile/domain/port changes create separate libraries; data clearing, private mode, eviction, and device loss can remove documents. Keep downloads safe and avoid secrets on shared GitHub Pages origins.

See [Using the workspace](https://timedilationv2.github.io/silov0/using-workspace.html) and the detailed source guide [docs/EDITORS.md](docs/EDITORS.md). These updated routes/features need deployment before they appear on the public site.

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

Root development dependencies require Node 20+. Static use needs no build. After changing runtime dependencies, run `npm run vendor` to regenerate the checked-in editor bundle, worker/WASM files, and license notices. Use the lockfiles.

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

- Root tests: typed documents, legacy backups, all-format restoration, worked templates, Markdown review, and real XML/XSD validation.
- Backend tests: API responses, authentication, CORS, limits, validation, concurrent writes, storage failures, and sample-reference accuracy. Writes use temporary fixtures.
- Workspace browser suite: real visual selection/table/list/search editing, source/preview round trips, XML parsing and XSD errors/repair, DITA topics/insertion/order, all templates, v1 migration/archive, every-format backups, quota/conflict recovery, safe imports/images, keyboard operation, responsive layouts, and screenshots of each editor.
- Example smoke suite: static JSON loading, search/filter, summary/table views, digest copy and failures, and sample links.
- Security browser suite: hostile sample metadata remains text; unsafe links are omitted.
- Site browser suite: shared navigation/theme, internal links and fragments, legacy routes, keyboard entry, mobile layout, and screenshots.

See [docs/TESTING.md](docs/TESTING.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [SECURITY.md](SECURITY.md). Only Chromium is covered automatically; other browsers, assistive technologies, device hardware, eviction policies, and power-loss behavior need separate validation.

## Deployment

GitHub Pages is configured for `main:/`. `_config.yml` excludes the backend, tests, manifests, and configuration from the generated static site. No writable API is deployed. `learn.html`, sample fragments, and former landing-page section links retain compatibility paths. Publishing this restructuring and verifying the live deployment are separate from local implementation and testing.
