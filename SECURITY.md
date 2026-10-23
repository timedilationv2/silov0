# Security hardening

Scope: reviewed every source, data, documentation and test file in the repository
snapshot at `49c8d2244ac2fbc1438ddf4d14b39757de5e3177`. During the hardening pass no deployment,
remote writes, real credentials, or .env files were created. This workspace was
materialized through the GitHub connector because Git clone was unavailable.

## Implemented protections

- Cards and table rows use DOM creation and textContent. Post titles, summaries,
  and tags never pass through an HTML parser. Existing structure and CSS remain.
- URLs are never inserted into browser HTML. Markdown export omits unsafe source
  schemes and escapes untrusted text; the CLI also escapes Markdown content.
- Every non-read method under /api requires Authorization: Bearer with the
  server's API_TOKEN. SHA-256 digests are compared using timingSafeEqual.
  GET/HEAD reads and OPTIONS preflight remain public. Unknown authenticated
  write routes still return 404. No token-issuance endpoint was introduced.
- Startup rejects missing, short (<32 characters), malformed, and example tokens.
  The server binds only to 127.0.0.1. No request-body or authentication logging
  was added. Malformed JSON and internal errors return generic messages.
- CORS only authorizes exact configured origins; empty configuration authorizes
  none. CORS is a browser response policy, not an authentication mechanism.
- Helmet supplies API security headers; x-powered-by is disabled. API rate limits
  are 300 requests/minute/IP and 20 writes/minute/IP, including failed auth.
  Forwarded IP headers are not trusted. JSON bodies are limited to 32 KiB.
- Limits: title 300 characters, summary 10,000, ID 320, URL 2,048; at most
  20 tags, each at most 64 characters. Strings are measured before trimming.
  Field types, calendar dates, duplicate IDs, normalization and sorting remain
  enforced. HTTP(S) and relative source URLs remain supported; other schemes,
  credentials and embedded whitespace/control characters are rejected.
- Tag indexing handles __proto__ and constructor as ordinary keys.
- Service writes acquire a filesystem directory lock for the complete
  read-modify-write, reload current disk data, and update cache only on success.
  This protects cooperating services and processes using the same resolved path.
- File saves use an exclusive random temporary file in the same directory, flush
  and close it, then rename it over the destination. Failed pre-rename writes
  preserve existing contents and clean up the temporary file. New files use 0600.

## Verification

Run backend checks with `cd backend && npm ci && npm test`. Tests use temporary
storage and fixture tokens, never the real posts file or real API credentials.
The security suite covers absent/invalid/valid bearer tokens, unauthorized write
methods, startup failure, generic JSON errors, malicious HTML/script payloads,
unsafe URLs, oversized fields/bodies, concurrent HTTP creation, multiple services
and separate writer processes, duplicate races, partial-write and rename failure,
CORS allowed/disallowed origins and preflight, security headers and rate limits.

Browser checks (serve locally as described in README):

```sh
python3 tests/demo_smoke.py http://localhost:8000/
python3 tests/security_browser.py http://localhost:8000/
```

The first verifies existing views, filtering, counts and responsive layout across
eight widths. The second routes malicious static JSON into the real page and
checks literal text, absence of injected elements/execution, and safe URL export.
Dependency check: `cd backend && npm audit --omit=dev`.

Verified in this workspace on Node 24 and Chromium: all 25 backend tests, both browser
checks, and dependency audit (zero known vulnerabilities). Node 18 compatibility
is declared by the dependencies but was not separately executed here.

## Compatibility changes

- Write clients must supply the bearer token. Server startup now requires token
  configuration. It no longer binds a public interface.
- Wildcard cross-origin access is removed. Configure exact origins explicitly.
- Previously accepted unsafe URL schemes, credential-bearing URLs, oversized
  fields, large request bodies, and invalid token configuration are rejected.
- Stored posts violating the new validation rules cause a generic API 500 rather
  than being silently accepted; review legacy data before starting the server.
- Exported Markdown now displays post-supplied markup literally. Source links,
  filtering, sorting, ID generation, response shapes and routes are preserved.

## Remaining limits and recommendations

These are operational limits or future recommendations, not verified production
protections. Keep the writable API local; this pass does not authorize exposure.

- A shared development token grants full write access. There are no individual
  identities, scoped permissions, expiry or audit trail. Rotate by restarting
  with a new token. Before any future public service, add HTTPS and an appropriate
  identity/access-control design and verify its deployment separately.
- Rate counters are in-process and reset on restart; they do not coordinate
  multiple server processes. Public deployments would need shared enforcement
  and an explicitly reviewed reverse-proxy/trust-proxy configuration.
- A process crash can leave posts/posts.json.lock and temporary files. After
  stopping all writers and verifying none are active, remove the stale lock
  directory and abandoned temporary files, then restart. Lock acquisition times
  out after five seconds and fails closed. There is no unsafe automatic lock
  stealing. Do not remove a live lock.
- Direct savePosts calls replace a full snapshot atomically; use service.add for
  concurrent creation. Manual editors and other non-cooperating writers must
  not modify the file while the API runs. Use one canonical storage path on a
  local filesystem supporting atomic rename. Reads are cached per service;
  refresh/restart to see changes written by another service or a manual edit.
- File contents are flushed before rename; the containing directory is not
  fsynced. This does not promise survival of every sudden power-loss scenario.
  Keep backups; storage failure recovery and distributed filesystems are outside
  this small JSON store's guarantees.
- Helmet protects Express responses only. A separate static host needs its own
  security headers and a publication allowlist excluding .git, backend internals,
  and secret files. Git ignores do not prevent static HTTP disclosure.
- External HTTP(S) links may lead to untrusted sites; scheme validation does not
  establish reputation. The backend never fetches submitted source URLs.
- Raw HTML remains stored as text, intentionally. Other consumers must escape
  it for their output context. Malformed manually edited static JSON can still
  disrupt the demo; API validation cannot protect files edited outside the API.

## Changed files

Modified: `.gitignore`, `README.md`, `index.html`, `scripts/app.js`,
`backend/README.md`, `backend/package.json`, `backend/package-lock.json`,
`backend/bin/silov0-digest.js`, `backend/src/app.js`, `backend/src/server.js`,
`backend/src/postsStore.js`, `backend/src/service.js`,
`backend/test/integration.test.js`.

Added: `.env.example`, `SECURITY.md`, `backend/test/security.test.js`,
`tests/security_browser.py`.

## Browser-local workspace (separate from the example-post API)

The additional workspace.html feature stores authored documents only in IndexedDB. No API adapter,
telemetry, CDN asset, or AI service receives them. The old static demonstration
and API documentation are retained at index.html (with learn.html as a compatibility alias); the Express implementation and
its authentication, CORS, headers, limits and locked atomic writes are unchanged.

Workspace protections:

- Marked and DOMPurify are locally bundled with locked dependency versions and
  licenses. Raw HTML is displayed literally, image requests are omitted, and
  sanitization uses a small element/attribute allowlist. Link protocols are checked
  separately. The title, sidebar, findings and messages use textContent.
- Root CSP blocks network connections and remote images, active embedded content,
  base URLs and form submissions. HTML downloads contain sanitized content and
  their own restrictive CSP. Markdown downloads contain raw author source; other
  renderers must apply their own XSS protections.
- IndexedDB saves check revisions atomically. Stale writers cannot silently
  overwrite newer data. Save failures keep the in-memory draft and expose retry,
  copy and recovery-download controls. Navigation will not discard a failed save.
- Import sizes/types and backup schemas are validated. Restore is confirmed,
  non-destructive, and atomic. Existing documents are never overwritten; copies
  receive fresh IDs and collision-safe titles. Downloads contain plaintext user
  content and should be handled as private data by the user.
- No real authored documents, backups, private browser profiles or credentials
  belong in Git. Browser tests use isolated temporary profiles and synthetic data.

Limits: IndexedDB is neither encryption nor a backup service. Browser resets,
eviction, profile/device loss, and forced kills before a save completes can lose
work. Backups are explicit user downloads. Pages project sites share an origin;
other scripts on that origin have access to the same browser storage. Use a
separate origin/custom domain for stronger isolation and avoid storing secrets.
There is no multi-user access control, synchronization, offline installation,
AI processing or factual verification. Native leave warnings are best effort.
