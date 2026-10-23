# Editor and format contracts

See the [workspace guide](../using-workspace.html) for user-facing instructions and template descriptions.

## Libraries and reproducibility

- Tiptap 3 / ProseMirror (MIT) owns visual selection, schema, input rules, inline/block formatting, nested lists, table operations and undo history. `prosemirror-search` (MIT) owns rich document search/replace.
- CodeMirror 6 / Lezer (MIT) owns source editing, highlighting, indentation, XML closing/completion, folding, search/replace, history, selection, and diagnostics. Small adapters connect existing commands to accessible controls; they do not implement an editing engine around a textarea.
- xmllint-wasm 5.3.0, using libxml2 2.13.8 (MIT), runs XML well-formedness and actual XSD validation in disposable workers with a 32 MiB memory cap and `--nonet`.
- Marked (MIT) and DOMPurify (Apache-2.0 OR MPL-2.0) render/sanitize the existing Markdown preview and visual imports/exports.

All exact versions, transitive dependencies, and integrity hashes are in package-lock.json. Run `npm ci && npm run vendor` to rebuild `assets/vendor/editors.js`, copy the XML worker/WASM files, and collect runtime notices in `assets/vendor/NOTICES.txt`. esbuild is a development dependency, not a runtime service. Static hosting requires no npm install or build. Runtime JS, workers, WASM, schema, and licenses are checked in; no third-party CDN is used.

## Native formats and conversions

`visual` stores supported HTML; `markdown` stores a GFM subset; `xml` and `dita` store XML source. Native exports use `.html`, `.md`, `.xml`, and `.dita`. Source editors preserve XML structure and comments; editing normalizes line endings to LF. UTF-8 is the supported import encoding.

Visual content supports paragraphs, headings 1–6 (toolbar offers 1–4), bold, italic, underline, strike, inline code, code blocks, nested lists, links, quotes, basic HTML tables, and local raster images. There is no DOCX support, arbitrary style preservation, pagination, or tracked changes. Images must be PNG/JPEG/WebP, have alt text, be <=200,000 bytes each, and number <=3; base64 data counts toward the document cap.

Markdown supports headings, emphasis, strike, code, quotes, lists, safe links, and GFM tables. HTML is literal, remote images are omitted, and task-list text is retained without interactive checkboxes. Marked and the CodeMirror GFM parser have different jobs: parsed source remains authoritative even for unsupported preview features.

No visual↔Markdown document toggle or automatic conversion is offered. Known bundled Markdown templates can initialize visual copies. Markdown reading-HTML export is one-way and retains the Markdown document. HTML import explicitly warns about schema/style normalization, preserves original source in `originalSource`, and offers a separate `.html.txt` inert-text download. A supported visual HTML export can be reopened through HTML import; source originals remain in backup. Sanitization may intentionally remove active content and remote images from the editable copy. Native Markdown/XML/DITA round trips do not reserialize source.

## XML schema validation

The supported XSD is `assets/schemas/release-manifest.xsd`, Documentation release manifest 1.0. It requires `releaseManifest` with `id` and `version`; ordered owner, releaseDate, then 1–32 artifact elements; each artifact has one title, required path, and draft/approved status. Actual libxml2 XSD validation checks ordering, cardinality, required attributes, date types, and enumeration values. The worked XML template is validated by the same engine used in the editor.

Selecting no schema gives well-formedness only. Imported schemas, schema discovery, remote schemaLocation resolution and general schema catalogs are not implemented. Parser diagnostics carry line/column when available. XSD errors generally give a line and use column 1 when no exact column is emitted.

## DITA 1.3 scope

Supported roots: unnamespaced unspecialized concept/conbody, task/taskbody, reference/refbody. The explicit subset is defined by `ditaElements` in `scripts/workspace/validation.mjs`, shared with CodeMirror completion and context insertion.

- Root: one required nonempty title, optional shortdesc, one matching required body, in that order; required unique XML-name topic ID.
- Taskbody: optional prereq and context, required nonempty steps, optional result and postreq, in order and at most once.
- Steps/substeps contain step/substep; each requires one nonempty cmd before optional info, substeps, stepresult as applicable.
- Concept bodies allow p, section, note, ul, ol and codeblock. Reference bodies allow section. Section titles precede content; block and inline child sets are checked.
- Basic inline ph, b, i, u, codeph, xref; IDs are checked for uniqueness. Supported attributes are id, xml:lang, href on xref, and type on note.
- Unknown elements/attributes are reported as outside the supported subset rather than silently discarded. Required elements, duplicate singleton elements, ordering and permitted structure produce source diagnostics.

These are **custom structural checks**, not full OASIS DTD/XSD grammar validation. They do not cover maps, specialization, domains, architectural defaults, all legal inline combinations, keyref/conref, conditional processing, reference resolution, or publishing. Attribute values other than ID are not exhaustively grammar-validated. Export to an external OASIS-aware toolchain for full DITA validation and DITA-OT publication. The complete OASIS grammar set is not bundled; this is an explicit scope limit, not a claimed complete validator. Templates use ordinary DITA 1.3 topic-specific structures within the subset.

## Safety and storage

DTD/entity declarations are rejected before XML parser/DOM outline use, and source is retained for editing/export. libxml2 receives `--nonet`, no entity-expansion or XInclude arguments, and only the bundled explicit XSD. No external schemas, entities, stylesheets or references are resolved. XML is never rendered as HTML. Imported HTML is allowlisted and sanitized before Tiptap and on paste/export; remote images are removed and CSP also blocks them. Retained raw HTML is never mounted in the page.

IndexedDB version 2 preserves the existing database name and documents store. Upgrade adds `legacy-v1` and archives original records in the same upgrade transaction, without rewriting them. Legacy records are read as Markdown with schemaVersion 2 defaults; a normal edit writes the current typed record. Existing ID, content, title, dates, collection and revision are retained. Failed upgrades are atomic, and blocked upgrades request closing older tabs. The archive is a migration safety copy, not synchronization or an external backup.

Version 2 JSON backups include format, schemaId, templateId, content, originalSource when present, and normal metadata. Restore accepts versions 1 and 2, normalizes legacy Markdown defaults, creates new IDs, and commits all copies atomically. Revision conflicts, generation-aware autosave, recovery exports, failed-save backups and beforeunload warnings remain. Plaintext storage/downloads, browser eviction, same-origin trust, and lack of sync/encryption remain limitations.
