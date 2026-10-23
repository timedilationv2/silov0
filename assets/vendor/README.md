# Bundled runtime assets

Run npm ci && npm run vendor from the repository root to reproduce these files. No CDN or runtime build is required.

- Tiptap/ProseMirror: visual editor (MIT)
- CodeMirror 6/Lezer: source editors (MIT)
- xmllint-wasm 5.3.0 / libxml2 2.13.8: worker-based XML and XSD validation (MIT)
- Marked: GFM parsing (MIT)
- DOMPurify: sanitization (Apache-2.0 OR MPL-2.0)

Exact versions are locked in package-lock.json. NOTICES.txt and xmllint/COPYING retain upstream notices. The esbuild development bundler is MIT.
