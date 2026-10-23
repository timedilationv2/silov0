# Verification notes

## Commands

Node 20+ supports development; Python 3 serves the static site. Chromium browser suites use isolated synthetic documents and temporary profiles, never a user's saved library.

```sh
npm ci
npm run vendor
npm test
(cd backend && npm ci && npm test)
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/workspace_browser.py
# With python3 -m http.server 8000 --bind 127.0.0.1 running:
python3 tests/demo_smoke.py http://localhost:8000/
python3 tests/security_browser.py http://localhost:8000/
python3 tests/site_browser.py http://localhost:8000/
```

Set `SILOV_CHROMIUM_EXECUTABLE=/usr/bin/chromium` to use an installed system browser instead of Playwright's downloaded Chromium. The browser executable and platform libraries must be available. Current local validation uses Node 24, Python 3.12, Playwright 1.62, and system Chromium 154.

## Coverage

- Eight Node tests exercise typed records, v1/v2 backups, all-format restore, worked templates, Markdown review findings, and real libxml2 XSD validation. The XML manifest passes; invalid enumeration values, missing required owner, and invalid date types fail.
- Twenty-six backend tests retain API responses, authentication, CORS, limits, validation, CLI/sample-reference accuracy, concurrent writes, and storage-failure coverage. They use temporary fixtures for writes.
- Sixteen workspace browser tests exercise visual selected-text formatting, nested lists, heading outline, rich find/replace, table row/column edits, undo/redo, local images with alt/size limits, save/reload and HTML export/reimport; Markdown source/preview, shortcuts, continuation and native round trips; XML matching/closing tags, folding, search/replace, parsing errors, XSD errors/repair and native round trips; all three DITA topic types, permitted-child insertion, ordering/singleton checks, errors/repair and native round trips; all nine templates, independent copies, separate guidance and no reload duplication.
- Storage workflows cover exact v1-record preservation and original archive, browser restart, all-format backups and legacy restores, stale-tab conflicts, quota/recovery download, failed-save backup, atomic restore rollback, disabled storage, malformed backups and oversized imports. Keyboard and four viewport widths are checked across every format.
- Untrusted HTML retains inert original source while scripts/events/SVG/remote images are removed from the visual copy/export. Markdown preview remains inert. XML DTD/entity declarations are rejected before parsing; no external requests are made.
- Documentation smoke tests retain bundled JSON loading, filters, summaries/table, digest export, and sample links. The metadata security regression retains XSS and unsafe-URL checks.
- Site regression checks nine pages, local links/fragments including the bundled schema, legacy routes, consistent navigation/theme, keyboard skip link, and responsive widths.

The workspace suite self-hosts beneath `/silov0/` to test GitHub Pages project paths. Editor screenshots are written outside the checkout to `/tmp/silov-editors` (or `SILOV_SCREENSHOTS`) for visual inspection; site screenshots default to `/tmp/silov-screenshots`. Desktop and mobile variants are captured for visual, Markdown, XML, and DITA. No private content belongs in Git.

## Limits and deployment

Only Chromium is exercised automatically here. Other browsers, assistive technology, hardware touch interaction, eviction, and power-loss behavior need separate testing. Clipboard/OS permissions vary. The source editor can leave focus with Escape then Tab. History is not persisted across reload. Large documents may encounter browser performance/storage limits despite the content cap.

DITA checks are the documented custom 1.3 topic subset, not full OASIS grammar validation. Full grammar checks and publication require a separate toolchain; maps, specialization and reference resolution are not claimed. Only the named XML manifest XSD is supported. Visual HTML↔Markdown conversion is deliberately not offered. HTML import may normalize unsupported rich structures while retaining the complete original source. No DOCX compatibility or factual validation is claimed.

This editor rebuild is implemented locally and has not been deployed or verified on the live Pages site. The existing `main` deployment belongs to the preceding site restructuring. Publishing the new editor changes and verifying live assets/routes remain separate actions. No editor API service is required; the sample API remains optional and local.
