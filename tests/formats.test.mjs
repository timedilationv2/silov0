import test from "node:test";
import assert from "node:assert/strict";
import {
  makeDocument,
  validateDocument,
  backupJSON,
  parseBackup,
  restoredCopies,
} from "../scripts/workspace/model.mjs";
test("version 1 records acquire lossless Markdown defaults; unknown versions are rejected", () => {
  const current = makeDocument(
    "Old notes",
    "# Keep exactly\n\n<!-- original -->",
  );
  const { format, templateId, schemaVersion, ...legacy } = current;
  assert.equal(validateDocument(legacy).format, "markdown");
  assert.equal(validateDocument(legacy).content, legacy.content);
  assert.deepEqual(
    parseBackup(
      JSON.stringify({
        format: "silov0-workspace",
        version: 1,
        documents: [legacy],
      }),
    ),
    [current],
  );
  assert.throws(() => validateDocument({ ...current, schemaVersion: 3 }));
});
test("every format survives backup and restore without source conversion", () => {
  const docs = ["visual", "markdown", "xml", "dita"].map((format) =>
    makeDocument(format, "<p>Exact &amp; source</p>\n", "", format, "example"),
  );
  assert.deepEqual(parseBackup(backupJSON(docs)), docs);
  const copies = restoredCopies(docs, docs);
  copies.forEach((doc, i) => {
    assert.equal(doc.format, docs[i].format);
    assert.equal(doc.content, docs[i].content);
    assert.notEqual(doc.id, docs[i].id);
  });
  assert.throws(() => validateDocument({ ...docs[0], format: "docx" }));
});

test("the bundled XML example passes real XSD validation and incorrect values fail", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: xmllint } = await import("xmllint-wasm");
  const { templates } = await import("../scripts/workspace/templates.mjs");
  const schema = await readFile(
    new URL("../assets/schemas/release-manifest.xsd", import.meta.url),
    "utf8",
  );
  const xml = templates.find((t) => t.id === "xml-manifest").content;
  assert.equal((await xmllint.validateXML({ xml, schema })).valid, true);
  for (const invalid of [
    xml.replace('status="approved"', 'status="unknown"'),
    xml.replace("<owner>Harbor documentation team</owner>", ""),
    xml.replace("2026-10-20", "not-a-date"),
  ]) {
    assert.equal(
      (await xmllint.validateXML({ xml: invalid, schema })).valid,
      false,
    );
  }
});
