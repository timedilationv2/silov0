# Verification and release notes

## Executed checks

The implementation was exercised locally on Node 24 and Chromium, including at
GitHub Pages' `/silov0/` project prefix. Test documents are synthetic and use
isolated temporary profiles and storage, never a user's existing browser profile.

| Check | Result / scope |
| --- | --- |
| Root `npm test` | 5 model/template/quality tests: schema/size/date validation, backup copies, all template structures, deterministic findings, and anchors/code exclusions |
| `cd backend && npm test` | 26 existing tests: API behavior, authentication, startup failures, validation, limits, CORS, headers, file failure/concurrency, and sample accuracy |
| `python3 tests/workspace_browser.py` | 14 browser scenarios listed below |
| `tests/demo_smoke.py <base>/learn.html` | Preserved sample library, both views, filters, exports, navigation, sample links, responsive layout |
| `tests/security_browser.py <base>/learn.html` | Existing sample-content XSS regression |
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

Desktop, mobile, dark and light screenshots were inspected locally. Backend
implementation and bearer-token configuration are unchanged. Clipboard tests
verify application behavior with a browser stub, not a guarantee that every OS
will grant clipboard permission.

## Deployment status and limitations

GitHub Pages is configured on `main:/`. The public build was verified as successful
at commit `4a98a7846ff81c58a5a9a1dd629ed40af3a81ade` before this workspace PR was
submitted. That build contains the previous portfolio, not the new workspace.
The workspace remains on its review branch until merge; no public acceptance-test
claim is made for this unmerged branch. After merge, verify the new build and run
the SOP flow at <https://timedilationv2.github.io/silov0/> with a fresh browser
profile. The writable Express API must remain undeployed.

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
