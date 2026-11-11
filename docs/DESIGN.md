# SiloV interface design

## Audit and direction

The starting interface already used restrained colors and honest product copy. The audit did not find decorative gradients or fabricated product claims. Its weaknesses were navigation and hierarchy: documentation pages provided only top navigation and inline links; the workspace repeated bordered controls without functional grouping; document options expanded in the toolbar and displaced the editor; the library, editor, and assistance panel appeared as unrelated containers. At tablet widths, Markdown split view squeezed two text columns beside the document library.

The direction is quiet competence: neutral surfaces, one blue action accent, clear borders, compact controls, and comfortable document typography. The documentation site and workspace share tokens and interaction states, with layouts suited to reading and authoring respectively.

## Shared system

- `styles.css` owns typography, spacing tokens, semantic colors, radius, controls, focus, dialogs, tables, code, and documentation layout. Light and dark tokens retain the existing theme preference key. Blue identifies links, selection, and primary actions; error and warning colors retain their separate meanings.
- System fonts avoid network requests and additional runtime dependencies. Monospaced source uses the existing editor typography. Controls use restrained four-pixel corners; borders separate functional areas without decorative elevation.
- Focus outlines and native semantics remain. Optional navigation preferences never touch document storage. Static documentation topic links remain usable without JavaScript; the mobile menu progressively collapses when scripting is available.

## Documentation

A shared topic rail separates workspace operation, writing examples, and development material. Current-page states identify location, and a persistent workspace link makes the primary tool easy to reach. On small screens a native disclosure keeps all destinations available without putting the full navigation above every article.

The article column has a readable maximum width. Local page indexes identify section destinations; tables scroll inside labeled keyboard-accessible regions. Search and topic filtering share a compact control area. Existing explanatory and storage information receives note and warning treatments so readers can distinguish operating constraints from ordinary prose. Technical examples, route names, fragments, legacy redirects, and search behavior remain intact.

The overview now explains the four authoring formats directly and gives access to the workspace and guide. Implementation details remain in the documentation rather than being added to authoring workflows.

## Writing workspace

The application header is compact and independent of the documentation article shell. The library has a distinct selected-document state, title search hint, and separated library operations. An empty library explains the actual format choices and opens the existing creation dialog; it does not generate documents automatically.

The title, document format, and save status establish document context. History/search, Markdown views, document assistance, and download/options have separate groups. Formatting uses low-emphasis controls so the document receives visual priority. Editor and preview labels clarify pane purpose. A single authoring frame joins the editor to the assistance panel; the latter remains separately scrollable and can still be hidden.

Document options overlay the toolbar instead of changing the editor position. Outside pointer activation dismisses the menu; Escape closes it and returns focus to its summary. All original actions, IDs, dialogs, and keyboard shortcuts remain available.

Desktop Markdown split view retains parallel panes. Below 1001 pixels the panes stack to preserve useful line lengths beside the library. On phones the library remains behind the existing Documents control, formatting scrolls horizontally, and the assistance panel moves below the editor. No view preference is rewritten to achieve the responsive layout.

## Preserved contracts

No routes, storage keys, document models, import/export formats, backend/API behavior, validation contracts, or runtime dependencies changed. Source-editor selection uses the shared accent token. The existing vendor build was run; bundled dependencies did not change. The repository remains a static HTML/CSS/JavaScript application with an optional Express backend.

## Verification

Validated with synthetic browser profiles against a local HTTP server:

- 8 model tests and 26 backend tests passed.
- All 16 workspace browser tests passed: real editing in all four formats, templates, persistence, migration, native exports, import normalization, all-format backup/restore, quota and revision conflicts, validation, keyboard workflows, and untrusted inputs.
- Site suite passed for nine routes, 36 internal destinations, fragments and legacy aliases, theme persistence, keyboard entry, and 320/390/768/1440-pixel widths.
- Added site assertions for mobile topic navigation, menu position stability, outside dismissal, Escape focus return, and readable tablet Markdown split layout.
- Documentation example smoke tests and browser XSS regressions passed.
- Reviewed rendered screenshots of the documentation hub, overview, workspace light/dark themes, and Markdown/XML/DITA editors at representative desktop, tablet, and phone sizes. Tablet review led to the stacked split-view correction.

Chromium is the only tested browser. Screen readers, physical touch devices, other browser engines, and long-session human usability testing remain outside this validation. The live GitHub Pages deployment is separate from this implementation; no deployment has been performed.
