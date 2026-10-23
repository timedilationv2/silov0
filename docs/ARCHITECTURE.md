# Workspace architecture

## Boundaries

```text
workspace.html + workspace.css
        │
        ▼
scripts/workspace/app.mjs (UI controller)
  ├── model.mjs        document schema, limits, backup validation, recovery copies
  ├── storage.mjs      IndexedDB repository, transactions, revision checks
  ├── templates.mjs    editable content scaffolds
  ├── markdown.mjs     Marked → DOMPurify → safe DOM fragment / HTML export
  └── quality.mjs      pure deterministic review(document) → finding[]

IndexedDB: silov0-workspace / documents
  { id, title, content, collection, createdAt, updatedAt, revision }

Separate legacy learning path:
index.html (also learn.html) → scripts/app.js → posts/posts.json
                           ↕ local-only Express API (not used by workspace)
```

No authored content travels along a network edge. Dependencies are vendored;
root CSP blocks connections, images, frames, objects and form submissions. The
workspace has no fetch, analytics, backend adapter, API key, or service worker.
Theme, view preference, and last selected ID use optional localStorage; document
content only uses IndexedDB. The old Learn demo fetches public example JSON.

## Save semantics

Edits update an in-memory document and mark it dirty. A 450 ms debounce triggers a
save; switching/create/delete/restore first flush pending changes. Only one save
runs at a time. Each snapshot carries the current revision and edit generation;
a successful older snapshot does not mark newer keystrokes as saved. A leave
warning covers pending edits where the browser permits it. No unload-time
asynchronous write is claimed to be guaranteed.

The repository checks the stored revision in the same readwrite transaction as
its update. A stale tab or a deleted document causes a conflict rather than an
upsert that recreates or overwrites another tab's version. The editor retains
its draft; Save a copy creates a new ID. Navigation reloads current stored records.
There is no real-time collaboration or background tab synchronization.

A document timestamp changes on edit, not merely when opened. IndexedDB transaction
completion, not the individual request's success event, marks the save complete.
Quota and transaction failures leave the existing committed version intact.

## Imports, backups and rendering

Imports add documents; they never replace an existing one. Backup format/version,
field types, sizes, IDs, dates and duplicate IDs are validated before confirmation.
Restore generates new IDs, handles title collisions, and inserts the whole batch
in one transaction. A failed batch is rolled back. Dates from backups are retained;
restored copies start a new revision sequence. Backups are plain JSON, not encrypted.

Marked handles GFM syntax. Raw HTML is escaped, images become inert alt-text
placeholders, and DOMPurify applies a small tag/attribute allowlist before the DOM
is mounted. Links have a separate protocol check. Heading anchors are generated
with the same normalization used by quality checks, including duplicate suffixes.
Standalone HTML export uses the same sanitized renderer and a restrictive CSP.
Quality line references are approximate for nested structures and inline content.
These checks do not validate external URLs or factual correctness.

## Extension contracts for future AI work

The current modules deliberately keep storage, rendering, checks and UI separate.
No fake provider, assistant, semantic search, or embeddings are implemented.
A future capability can adopt the following contracts without changing the schema:

- Drafting / notes conversion: immutable `{ instruction, documentSnapshot, sources }`
  plus an AbortSignal → a proposed `{ title, content, citations }`. Show a diff and
  require explicit acceptance; never mutate the stored document inside a provider.
- Review: `{ documentSnapshot, sources }` → findings shaped like the current
  `{ severity, rule, line, message, explanation }`, with provenance identifying AI
  output. Keep deterministic checks independent and reproducible.
- Grounded Q&A: an explicitly selected source snapshot → answer plus citations
  carrying source ID, revision and location. Reject unsupported claims or mark
  uncertainty. Do not imply the current workspace provides this capability.
- Semantic search: an optional index keyed by document ID and revision, invalidated
  on edit/delete. Keyword title search remains a simple local fallback.

Any remote provider requires a separate privacy/consent design, credentials on a
trusted server, reviewed CSP changes and explicit user selection of transmitted
content. It must not silently upload the local library. A local-only provider
would still need resource limits and tests. Do not add an API key input to this
static page or repurpose the public example-post API for private documents.

## Deliberate limits

The native textarea offers predictable keyboard editing and undo, not syntax
coloring or a rich-text/WYSIWYG model. Large documents are size-limited; rendering
and checks currently run on the main thread. Moving expensive work into a worker
is a future optimization requiring measured need. The same-origin trust model,
browser eviction, absence of sync/encryption, and backup limits are documented
in the README. All current editing is account-free and local.
