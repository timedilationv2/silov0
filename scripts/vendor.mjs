// Browser dependencies are checked in: no CDN, install, or build needed to run.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("assets/vendor", { recursive: true });
for (const [source, target] of [
  ["node_modules/marked/lib/marked.esm.js", "assets/vendor/marked.esm.js"],
  ["node_modules/dompurify/dist/purify.es.mjs", "assets/vendor/purify.es.mjs"],
  ["node_modules/marked/LICENSE.md", "assets/vendor/marked.LICENSE.md"],
  ["node_modules/dompurify/LICENSE", "assets/vendor/dompurify.LICENSE"],
])
  await copyFile(source, target);
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
await writeFile(
  "assets/vendor/README.md",
  `# Browser dependencies\n\nLocally bundled for privacy and GitHub Pages. Regenerate with npm ci && npm run vendor.\n\n- Marked ${lock.packages["node_modules/marked"].version} (Markdown parsing)\n- DOMPurify ${lock.packages["node_modules/dompurify"].version} (sanitization)\n\nLicenses are included. Do not edit the bundled files directly.\n`,
);

// ProseMirror/Tiptap and CodeMirror share one bundled dependency graph.
const { build } = await import("esbuild");
await build({
  entryPoints: ["scripts/editor-libraries.mjs"],
  outfile: "assets/vendor/editors.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "eof",
});
await mkdir("assets/vendor/xmllint", { recursive: true });
for (const name of [
  "index-browser.mjs",
  "xmllint-browser.mjs",
  "xmllint.wasm",
  "COPYING",
]) {
  await copyFile(
    "node_modules/xmllint-wasm/" + name,
    "assets/vendor/xmllint/" + name,
  );
}
const { readdir } = await import("node:fs/promises");
// Include upstream notices for every bundled transitive runtime package.
const packages = Object.entries(lock.packages).filter(
  ([path, info]) => path.startsWith("node_modules/") && !info.dev,
);
let licenses = "# Runtime dependency notices\n\n";
for (const [path, info] of packages) {
  licenses += `\n## ${path.replace("node_modules/", "")} ${info.version} (${info.license || "see notice"})\n\n`;
  for (const name of await readdir(path))
    if (/^(license|copying|notice)(\.|$)/i.test(name))
      licenses += (await readFile(path + "/" + name, "utf8")) + "\n";
}
await writeFile("assets/vendor/NOTICES.txt", licenses);
await writeFile(
  "assets/vendor/README.md",
  `# Bundled runtime assets\n\nRun npm ci && npm run vendor from the repository root to reproduce these files. No CDN or runtime build is required.\n\n- Tiptap/ProseMirror: visual editor (MIT)\n- CodeMirror 6/Lezer: source editors (MIT)\n- xmllint-wasm 5.3.0 / libxml2 2.13.8: worker-based XML and XSD validation (MIT)\n- Marked: GFM parsing (MIT)\n- DOMPurify: sanitization (Apache-2.0 OR MPL-2.0)\n\nExact versions are locked in package-lock.json. NOTICES.txt and xmllint/COPYING retain upstream notices. The esbuild development bundler is MIT.\n`,
);
