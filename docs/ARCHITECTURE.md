# Workspace architecture

## Components and boundaries

```text
workspace.html + styles.css + workspace.css
  → scripts/workspace/app.mjs (UI, native format routing, generation-aware autosave)
      ├── editors.mjs      Tiptap/ProseMirror and CodeMirror adapters, safe visual HTML
      ├── model.mjs        typed documents, limits, versioned backups, restore copies
      ├── storage.mjs      IndexedDB v2, legacy archive, transactions and revision checks
      ├── templates.mjs    worked examples + separate audience/purpose/guidance
      ├── markdown.mjs     Marked → DOMPurify → preview / reading HTML
      ├── quality.mjs      deterministic Markdown structural review
      └── validation.mjs   XML safety gate, libxml2 worker, explicit XSD, DITA subset

assets/vendor/editors.js              bundled maintained editor components
assets/vendor/xmllint/                worker module + WASM + notices
assets/schemas/release-manifest.xsd   named XML schema (not DITA grammar)

IndexedDB: silov0-workspace (version 2)
  documents: typed current records, existing v1 records retained until edited
  legacy-v1: original v1 records archived by the upgrade transaction

Separate examples path:
documentation.html (also learn.html) → scripts/app.js → posts/posts.json
                                                         │ metadata + links
                                                         ▼
                                                    samples.html
posts/posts.json ↔ optional local Express API (never used by the workspace)
```

The Overview / Workspace / Documentation / GitHub navigation and stable workspace URL remain. `scripts/site.js` manages non-workspace theme and legacy fragment routing; the workspace retains its own controller. Both use the existing `silov0-theme` preference. No authored content is sent to the sample API, GitHub, analytics, AI, or a CDN. The local validator fetches only its bundled assets/XSD and receives source by worker message.

## Editor contracts

See [EDITORS.md](EDITORS.md) for libraries, supported dialects, exact DITA scope, templates, and conversion limitations. Visual editing is real contenteditable ProseMirror state, not textarea Markdown controls. CodeMirror owns all three source editors. The controller consumes a common adapter for content, commands, outline navigation, line selection, and diagnostics. Native format is immutable per document; no silent cross-format serialization is offered.

Markdown Source/Split/Preview views share one source string. Visual HTML stores supported schema content and sanitizes HTML imports/paste/exports. Unsupported imported HTML is retained separately in `originalSource` after explicit confirmation. XML and DITA keep source rather than reserializing a DOM. DTD/entity declarations are rejected before parsing, and no external resources are resolved. DITA is a custom DITA 1.3 structural subset, explicitly not full OASIS grammar validation. The XML manifest option performs actual libxml2 XSD validation.

## Storage and migration

Records contain the existing ID, title, content, collection, timestamps and revision, plus `format`, `schemaVersion`, `templateId`, optional `schemaId`, and optional `originalSource`. Version 1 records receive Markdown defaults when read; opening them does not rewrite them. Upgrade adds `legacy-v1` and copies original records within the upgrade transaction without altering the documents store. IDs, timestamps, revisions, and source remain intact. Editing writes the typed current record; archived originals stay unchanged. A failed upgrade rolls back; old open tabs close their connection on versionchange or prompt retry if blocked.

The same database/origin preserves documents created under the former homepage entry point. Theme, view, and last selected ID use optional localStorage; content uses IndexedDB. Origin/profile/port changes do not migrate storage automatically. The legacy archive is a local upgrade safeguard, not an external backup.

## Save semantics and failures

Edits update in-memory content and set dirty state. A 450 ms debounce saves; switching, creation, deletion, and restore first flush pending changes. One save runs at a time. Snapshot generation prevents an older successful save from marking later keystrokes as saved. Transaction completion marks success. Revision checks happen atomically with writes; a stale tab cannot overwrite or recreate another tab's deleted document. Save a copy assigns a fresh ID with the current complete typed draft. There is no live collaboration.

Quota/storage failures retain drafts and expose retry/native download/copy recovery. Backup after a failed save includes committed records and a separate unsaved recovery record when capacity allows. Restore is a validated, confirmed, all-or-nothing insertion of new-ID copies. Beforeunload warnings are best effort; forced close before commit can lose work. Editor undo history is per mounted document, not persisted.

Version 2 JSON backup preserves all formats, schema selection, template reference, native source, and original imported HTML. Restore accepts v1 and v2. Content/image/import/backup limits are validated. Downloaded files and local storage are plaintext. Review findings do not verify facts; XML well-formedness, selected XSD validation, and DITA subset checks are always labeled separately.

## Static hosting

Runtime assets, worker/WASM, schema and notices are checked in. Python's static server and GitHub Pages can serve the application; no editor backend or API key is required. `npm ci && npm run vendor` rebuilds runtime assets after dependency changes using esbuild. Workspace CSP allows same-origin assets/workers, WebAssembly compilation, editor-generated styles and data-URL raster images; remote scripts/images, objects, frames, base replacement and form submissions are blocked. There is no service worker or guaranteed offline install. Full DITA grammar validation/publishing uses an external OASIS-aware toolchain and is not simulated in the browser.
