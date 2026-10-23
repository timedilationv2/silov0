# Verification notes

## Current restructuring

Local validation uses Node 24, Python 3.12, Playwright 1.62, and system Chromium 154. The browser suites also support Playwright's downloaded Chromium by omitting `SILOV_CHROMIUM_EXECUTABLE`.

```sh
npm test
(cd backend && npm test)
SILOV_CHROMIUM_EXECUTABLE=/usr/bin/chromium python3 tests/workspace_browser.py
# With python3 -m http.server 8000 --bind 127.0.0.1 running:
SILOV_CHROMIUM_EXECUTABLE=/usr/bin/chromium python3 tests/demo_smoke.py http://localhost:8000/
SILOV_CHROMIUM_EXECUTABLE=/usr/bin/chromium python3 tests/security_browser.py http://localhost:8000/
SILOV_CHROMIUM_EXECUTABLE=/usr/bin/chromium python3 tests/site_browser.py http://localhost:8000/
```

| Suite                        | Coverage                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root Node tests (5)          | Document/backup validation, template structure, deterministic review findings and anchors                                                                 |
| Backend tests (26)           | API behavior, authentication, validation, CORS, rate limits, concurrent writes, storage failures, CLI and checked-in reference accuracy                   |
| Workspace browser tests (17) | Editing, persistence, templates, example copies, review, exports, backup/restore, recovery, conflicts, storage compatibility, responsive behavior and XSS |
| Documentation example smoke  | Bundled JSON reads, summary/table views, filters, digest copying, empty selections, sample links, responsive layout                                       |
| Sample security regression   | Hostile titles/summaries/tags remain text; unsafe source URLs are omitted                                                                                 |
| Site browser regression      | Nine pages, internal links/fragments, old URLs, shared navigation and theme, keyboard skip link, four viewport widths, screenshots                        |

The workspace suite serves its own loopback HTTP server beneath `/silov0/`. It uses isolated synthetic documents and browser profiles. It checks browser-restart persistence, the former homepage entry point, and a record seeded directly into the unchanged database with a known ID, timestamps, collection, and revision. Navigating through the new pages must preserve that record exactly.

New-document tests check cancellation, all five content templates, a realistic example copy, deliberate creation of a second copy with existing work preserved, and no extra documents on reload. Review, import, export, JSON validation, restore rollback, concurrent-tab conflicts, quota failure, and recovery checks remain in place. A storage-unavailable case checks that creation stays disabled.

The site suite checks actual link destinations and fragments, including redirects for former landing-page sections and the `learn.html` alias. Screenshots go outside the checkout to `/tmp/silov-screenshots` by default; `SILOV_SCREENSHOTS` overrides that location. Desktop, mobile, and dark-theme renders support visual inspection. Tests select a system browser through Playwright's supported `executable_path` option, without changing browser security settings.

## Limits and deployment

Only Chromium is covered here. Firefox, Safari, assistive technologies, touch hardware, browser eviction, and disk/power-loss scenarios need separate validation. Clipboard checks use browser stubs for success and rejection; they do not establish OS permission behavior. IndexedDB commit completion is tested, but forced close before commit can lose edits.

Review findings check structure, not factual accuracy, external-link reachability, or completeness. Source lines are approximate for nested Markdown. There is no service worker or guaranteed offline reopening. Downloads and browser storage are not encrypted.

This restructuring is implemented and validated locally. It has not been deployed or verified on the live Pages site. GitHub Pages serves static files from `main:/` after deployment; no writable API is hosted. Publishing and checking the live routes remain separate steps.
