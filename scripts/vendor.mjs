// Browser dependencies are checked in: no CDN, install, or build needed to run.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
await mkdir('assets/vendor', { recursive: true })
for (const [source, target] of [
  ['node_modules/marked/lib/marked.esm.js', 'assets/vendor/marked.esm.js'],
  ['node_modules/dompurify/dist/purify.es.mjs', 'assets/vendor/purify.es.mjs'],
  ['node_modules/marked/LICENSE.md', 'assets/vendor/marked.LICENSE.md'],
  ['node_modules/dompurify/LICENSE', 'assets/vendor/dompurify.LICENSE'],
]) await copyFile(source, target)
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
await writeFile('assets/vendor/README.md', `# Browser dependencies\n\nLocally bundled for privacy and GitHub Pages. Regenerate with npm ci && npm run vendor.\n\n- Marked ${lock.packages['node_modules/marked'].version} (Markdown parsing)\n- DOMPurify ${lock.packages['node_modules/dompurify'].version} (sanitization)\n\nLicenses are included. Do not edit the bundled files directly.\n`)
