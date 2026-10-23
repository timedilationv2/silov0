# Verification and release notes

## Executed checks

The implementation was exercised locally on Node 24 and Chromium, including at
GitHub Pages' `/silov0/` project prefix. Test documents are synthetic and use
isolated temporary profiles and storage, never a user's existing browser profile.

| Check | Result / scope |
| --- | --- |
| Root `npm test` | 5 model/template/quality tests: schema/size/date validation, backup copies, all template structures, deterministic findings, and anchors/code exclusions |
| `cd backend && npm test` | 26 existing tests: API behavior, authentication, startup failures, validation, limits, CORS, headers, file failure/concurrency, and sample accuracy |
| `python3 tests/workspace_browser.py` | 15 browser scenarios including entry-point compatibility |
| `tests/demo_smoke.py <base>/` | Preserved sample library, both views, filters, exports, navigation, sample links, responsive layout |
| `tests/security_browser.py <base>/` | Existing sample-content XSS regression |
| `npm audit --omit=dev` | Zero known vulnerabilities in root dependencies at verification time |

Workspace browser scenarios:

1. All five templates create real editable documents with rendered headings.
2. Saved data reopens after closing and relaunching a persistent browser profile.
3. Stale saves in another tab are rejected and Save a copy preserves both drafts.
4. Create, rename, collection assignment/filtering, search, immediate switching,
   delete cancellation and confirmed deletion.
5. Markdown import, HTML export, JSON backup, cancelled restore, conflict-safe
   restored copies and plain-text import.
6. Initial IndexedDB failure is visible and disables creation.
7. Malformed/unsupported backups and wrong-type/oversized imports leave data intact.
8. GFM headings, lists, code, links, tables and emphasis; view controls; keyboard
   formatting/save; clipboard API success and permission-denied fallback (stubbed).
9. Mobile document navigation, theme persistence, no horizontal page overflow at
   320/390/640/768/1024/1440 pixels, Tab indentation and Shift+Tab escape.
10. Quality findings show errors/warnings and navigate to title/source lines.
11. A simulated failure during the second restore insert rolls back the whole batch.
12. SOP creation → rename/edit → live preview → autosave → refresh → Markdown
    download → create another document → reopen the SOP.
13. Simulated quota failure retains the editor, blocks destructive switching,
    exports recovery Markdown, backs up both stored/draft versions, and recovers
    after retry without losing work.
14. Malicious imported Markdown/title/URLs do not create scripts/images/SVG or
    execute code; rendered HTML downloads are inert; editing/importing makes no
    content-bearing or remote-image network requests.

15. A document saved under the former homepage entry point reopens at the additional
    workspace URL with the same title and content, without migration.

Desktop, mobile, dark and light screenshots were inspected locally. Backend
implementation and bearer-token configuration are unchanged. Clipboard tests
verify application behavior with a browser stub, not a guarantee that every OS
will grant clipboard permission.

## Deployment status and limitations

GitHub Pages is configured on `main:/`. The workspace implementation was merged
and the public build at `ca97d62952aeb4541b9932dccdf68d6f378242fa` was verified,
including a live SOP create/edit/save/refresh/export/reopen check. This subsequent
correction restores the portfolio homepage and serves the workspace as an additive
feature at `workspace.html`. Its same-origin IndexedDB data is unchanged.
The local browser suite also verifies that documents saved from the former homepage
entry point reopen at `/silov0/workspace.html`. No writable API is deployed.

Only Chromium was executed here. Firefox, Safari, touch-device hardware,
assistive-technology testing and OS-level disk/power failures need separate
coverage. Browser eviction/private-session retention differs by browser. IndexedDB
commit completion was tested; forced close before that point is not a durability
guarantee. A native leave warning is best effort, and loaded assets are needed to
reopen the app (there is no offline service worker).

Quality checks find deterministic structure issues, not factual accuracy, external
link reachability, style-guide compliance or an authoritative quality score.
Nested-block line locations are approximate. Inline HTML is intentionally literal;
images are intentionally not loaded. Content is plaintext local storage and shares
the GitHub Pages origin with other projects on that hostname. Read README and
SECURITY.md before keeping sensitive material in the workspace.


## Additive navigation correction

The portfolio remains at the root URL with its original six-section structure;
the workspace is linked as an additional feature at `workspace.html`. The workspace
suite targets `/silov0/workspace.html`. Browser storage stays on the same origin
and uses the same database, so earlier workspace documents do not need migration.
