import { openStore } from "./storage.mjs";
import {
  makeDocument,
  backupJSON,
  parseBackup,
  restoredCopies,
  fileName,
  MAX_CONTENT,
  MAX_FILE_BYTES,
  MAX_BACKUP_BYTES,
  MAX_DOCUMENTS,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
} from "./model.mjs";
import { templates } from "./templates.mjs";
import { renderMarkdown, exportHTML } from "./markdown.mjs";
import { reviewDocument } from "./quality.mjs";
import { mountEditor, sanitizeVisual } from "./editors.mjs";
import { validateSource } from "./validation.mjs";

const $ = (id) => document.getElementById(id);
const node = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const preferences = {
  get(key, fallback = "") {
    try {
      return localStorage.getItem("silov0-" + key) || fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("silov0-" + key, value);
    } catch {
      /* Optional preferences */
    }
  },
};
const formatNames = {
  visual: "Visual HTML",
  markdown: "Markdown · GFM subset",
  xml: "XML · UTF-8",
  dita: "DITA 1.3 · topic subset",
};
const extensions = {
  visual: ".html",
  markdown: ".md",
  xml: ".xml",
  dita: ".dita",
};
let store,
  documents = [],
  active = null,
  editor = null,
  dirty = false,
  generation = 0,
  saving = null,
  busy = false,
  saveTimer,
  renderTimer,
  validationRun = 0;
function notice(text) {
  $("notice").textContent = text;
}
function saveStatus(text, state = "saved") {
  $("save-status").textContent = text;
  $("save-status").dataset.state = state;
}
function showError(error) {
  $("error-text").textContent =
    error.name === "QuotaExceededError"
      ? "Browser storage is full. Your draft remains in the editor. Download it before leaving, then free storage and retry."
      : error.message || "Operation failed; your draft is retained.";
  $("error").hidden = false;
  if ($("image-dialog").open)
    $("image-error").textContent = $("error-text").textContent;
  $("save-copy").disabled = !active || !store;
  $("recover-md").disabled = !active;
  $("retry").textContent = store ? "Retry save" : "Retry storage";
}
function clearError() {
  $("error").hidden = true;
}
function displayTitle(doc) {
  return doc.title.trim() || "Untitled document";
}
function uniqueTitle(base) {
  let title = base,
    n = 2;
  const titles = new Set(documents.map((d) => d.title));
  while (titles.has(title)) title = `${base.slice(0, 175)} (${n++})`;
  return title;
}
function renderNavigation() {
  const all = documents.map((d) => (d.id === active?.id ? active : d)),
    query = $("search-docs").value.toLowerCase(),
    filter = $("collection-filter").value;
  const fragment = document.createDocumentFragment();
  for (const doc of all
    .filter(
      (d) =>
        displayTitle(d).toLowerCase().includes(query) &&
        (!filter || d.collection === filter),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const b = node("button", undefined, "document-item");
    b.setAttribute("aria-current", String(doc.id === active?.id));
    b.append(
      node("strong", displayTitle(doc)),
      node(
        "span",
        (doc.format || "markdown") + " · " + (doc.collection || "Unfiled"),
      ),
    );
    b.onclick = () => operation(() => openDocument(doc.id));
    fragment.append(b);
  }
  if (!fragment.childNodes.length)
    fragment.append(
      node(
        "p",
        all.length
          ? "No matching documents. Clear the search or collection filter."
          : "No documents yet. Choose New document.",
      ),
    );
  $("document-list").replaceChildren(fragment);
  $("document-count").textContent = all.length;
  const collections = [
      ...new Set(all.map((d) => d.collection).filter(Boolean)),
    ].sort(),
    select = $("collection-filter");
  select.replaceChildren(
    new Option("All collections", ""),
    ...collections.map((c) => new Option(c, c)),
  );
  if (filter && !collections.includes(filter))
    select.append(new Option(filter, filter));
  select.value = filter;
  $("collections").replaceChildren(...collections.map((c) => new Option(c, c)));
}
function setView(view) {
  if (!["editor", "split", "preview"].includes(view)) view = "split";
  $("workspace").dataset.view = view;
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  preferences.set("view", view);
  editor?.source?.requestMeasure();
}
function panel() {
  for (const name of ["outline", "guidance", "validation"])
    $(name + "-panel").hidden = $("panel").value !== name;
}
function selectionChanged() {
  if (!editor || !active) return;
  $("table-tools").hidden =
    active.format !== "visual" || !editor.visual?.isActive("table");
  if (editor.visual) {
    for (const b of document.querySelectorAll("[data-command]")) {
      const mark = {
        bold: "bold",
        italic: "italic",
        underline: "underline",
        inlineCode: "code",
        bullet: "bulletList",
        ordered: "orderedList",
        quote: "blockquote",
        codeBlock: "codeBlock",
      }[b.dataset.command];
      if (mark)
        b.setAttribute("aria-pressed", String(editor.visual.isActive(mark)));
    }
    $("block-style").value =
      editor.visual.getAttributes("heading").level || "0";
  }
  if (active.format === "dita") {
    const context = editor.context();
    $("dita-context").textContent = context
      ? `Inside <${context.tag}>`
      : "Select an element in the outline";
    const select = $("dita-element"),
      previous = select.value;
    select.replaceChildren(
      ...(context?.children || []).map((c) => new Option(c, c)),
    );
    if ([...select.options].some((o) => o.value === previous))
      select.value = previous;
    $("insert-element").disabled = !context?.children.length;
  }
}
function renderOutline() {
  if (!editor) return;
  const entries = editor.outline(),
    fragment = document.createDocumentFragment();
  for (const entry of entries) {
    const b = node("button", entry.text);
    b.style.paddingInlineStart = Math.min(entry.level, 7) * 10 + "px";
    b.onclick = entry.go;
    fragment.append(b);
  }
  if (!entries.length)
    fragment.append(
      node(
        "p",
        active?.format === "visual"
          ? "Add headings to build an outline."
          : "No headings or XML elements yet.",
      ),
    );
  $("outline").replaceChildren(fragment);
}
function renderGuidance() {
  const t = templates.find((t) => t.id === active?.templateId);
  $("guidance").replaceChildren(
    ...(t
      ? [
          node("p", "Audience: " + t.audience),
          node("p", "Purpose: " + t.purpose),
          node("p", t.guidance),
          node(
            "p",
            "This guidance is not part of your document and is not exported.",
          ),
        ]
      : [
          node(
            "p",
            "No template guidance is attached. This document was started blank or imported.",
          ),
        ]),
  );
}
async function renderContent() {
  if (!active || !editor) return;
  const run = ++validationRun,
    doc = { ...active };
  renderOutline();
  selectionChanged();
  $("word-count").textContent =
    `${doc.content.length.toLocaleString()} / ${MAX_CONTENT.toLocaleString()} characters`;
  let findings = [],
    scope;
  if (doc.format === "markdown") {
    $("preview").replaceChildren(renderMarkdown(doc.content));
    findings = reviewDocument(doc);
    scope = "Markdown structural review; not factual verification";
  } else if (doc.format === "visual") {
    scope = "Visual document checks; not factual verification";
    const parsed = new DOMParser().parseFromString(
      sanitizeVisual(doc.content),
      "text/html",
    );
    if (!doc.title.trim())
      findings.push({
        message: "Missing document name",
        severity: "warning",
        line: 0,
        column: 1,
      });
    if (!parsed.body.textContent.trim())
      findings.push({
        message: "The document has no text yet",
        severity: "warning",
        line: 0,
        column: 1,
      });
  } else {
    $("validation-status").textContent = "Checking XML source…";
    try {
      ({ findings, scope } = await validateSource(
        doc.content,
        doc.format,
        doc.schemaId || "none",
      ));
    } catch (error) {
      scope = "Validation unavailable";
      findings = [
        { message: error.message, severity: "error", line: 1, column: 1 },
      ];
    }
  }
  if (
    run !== validationRun ||
    active?.id !== doc.id ||
    active.content !== doc.content
  )
    return;
  const errors = findings.filter((f) => f.severity === "error").length,
    warnings = findings.length - errors;
  $("validation-status").textContent =
    `${errors} errors · ${warnings} warnings · ${scope}`;
  $("validation-scope").textContent = scope;
  const fragment = document.createDocumentFragment();
  for (const f of findings) {
    const b = node("button", undefined, "finding");
    b.append(node("strong", `${f.severity}: ${f.message}`));
    if (f.line)
      b.append(
        node(
          "span",
          `Line ${f.line}, column ${f.column || 1}${f.explanation ? " · " + f.explanation : ""}`,
        ),
      );
    b.onclick = () => {
      if (!f.line) {
        $("doc-title").focus();
        return;
      }
      setView("editor");
      editor.selectLine(f.line, f.column || 1);
    };
    fragment.append(b);
  }
  if (!findings.length)
    fragment.append(
      node(
        "p",
        "No findings within the stated scope. This does not prove completeness or factual accuracy.",
      ),
    );
  $("findings").replaceChildren(fragment);
  editor.diagnostics(findings.filter((f) => f.line > 0));
}
function setActive(doc) {
  clearTimeout(saveTimer);
  clearTimeout(renderTimer);
  validationRun++;
  editor?.destroy();
  editor = null;
  active = doc ? { ...doc } : null;
  dirty = false;
  generation++;
  $("welcome").hidden = !!active;
  $("document-area").hidden = !active;
  if (active) {
    $("workspace").dataset.format = active.format;
    $("doc-title").value = active.title;
    $("doc-collection").value = active.collection;
    $("document-format").textContent = formatNames[active.format];
    $("timestamps").textContent =
      "Modified " + new Date(active.updatedAt).toLocaleString();
    $("export-md").textContent = "Download " + extensions[active.format];
    $("recover-md").textContent =
      "Download current " + extensions[active.format];
    $("export-html").hidden = !["markdown", "visual"].includes(active.format);
    $("export-original").hidden = active.originalSource === undefined;
    $("writing-tools").hidden = !["markdown", "visual"].includes(active.format);
    $("xml-tools").hidden = !["xml", "dita"].includes(active.format);
    $("schema-label").hidden = active.format !== "xml";
    $("schema").value = active.schemaId || "none";
    $("dita-insertion").hidden = active.format !== "dita";
    $("view-controls").hidden = active.format !== "markdown";
    $("visual-search").hidden = true;
    for (const el of document.querySelectorAll("[data-only]"))
      el.hidden = active.format !== el.dataset.only;
    editor = mountEditor(
      $("editor-host"),
      active,
      (content, error) => {
        if (error) {
          showError(error);
          return;
        }
        active.content = content;
        edit();
      },
      selectionChanged,
    );
    preferences.set("active", active.id);
    saveStatus("Saved locally");
    renderGuidance();
    renderContent();
  } else {
    preferences.set("active", "");
  }
  renderNavigation();
}
function edit() {
  if (!active) return;
  active.title = $("doc-title").value;
  active.collection = $("doc-collection").value;
  active.updatedAt = new Date().toISOString();
  dirty = true;
  generation++;
  saveStatus("Unsaved changes…", "pending");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 450);
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderContent, 500);
  renderNavigation();
}
async function saveOnce() {
  if (saving) return saving;
  const snapshot = { ...active },
    version = generation;
  saving = (async () => {
    try {
      saveStatus("Saving…", "pending");
      const saved = await store.save(snapshot);
      documents = documents.map((d) => (d.id === saved.id ? saved : d));
      if (active?.id === saved.id) {
        active.revision = saved.revision;
        if (version === generation) dirty = false;
        saveStatus(
          dirty ? "Unsaved changes…" : "Saved locally",
          dirty ? "pending" : "saved",
        );
        $("timestamps").textContent =
          "Modified " + new Date(active.updatedAt).toLocaleString();
      }
      clearError();
      renderNavigation();
      return true;
    } catch (error) {
      saveStatus("Not saved — download a copy", "error");
      showError(error);
      return false;
    }
  })();
  try {
    return await saving;
  } finally {
    saving = null;
  }
}
async function flush() {
  clearTimeout(saveTimer);
  while (dirty && active) if (!(await saveOnce())) return false;
  if (saving) return await saving;
  return true;
}
async function operation(task) {
  if (busy) return;
  busy = true;
  for (const id of ["create", "new-document", "welcome-create", "delete"])
    $(id).disabled = true;
  try {
    await task();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    for (const id of ["create", "new-document", "welcome-create"])
      $(id).disabled = !store;
    $("delete").disabled = false;
  }
}
function closeMobileNav() {
  $("sidebar").classList.remove("is-open");
  $("toggle-nav").setAttribute("aria-expanded", "false");
}
async function openDocument(id) {
  if (id === active?.id) return;
  if (!(await flush())) return;
  documents = await store.list();
  const doc = documents.find((d) => d.id === id);
  if (!doc) {
    notice("That document no longer exists. Refresh the library.");
    renderNavigation();
    return;
  }
  setActive(doc);
  closeMobileNav();
}
function renderTemplateOptions() {
  const format = $("new-format").value;
  const options = templates.filter(
    (t) =>
      t.id === "blank" ||
      t.format === format ||
      (format === "visual" && t.format === "markdown"),
  );
  $("template").replaceChildren(
    ...options.map((t) => new Option(t.name, t.id)),
  );
  templateSummary();
}
function templateSummary() {
  const t = templates.find((t) => t.id === $("template").value);
  $("template-summary").textContent = t
    ? `${t.audience}. ${t.purpose} ${t.guidance}`
    : "";
  $("create").textContent =
    t?.id === "blank" ? "Create blank document" : "Use template";
}
async function createDocument() {
  if (!(await flush())) return;
  documents = await store.list();
  if (documents.length >= MAX_DOCUMENTS)
    throw new Error(
      "The 500-document limit is reached. Back up and remove unused documents first.",
    );
  const template =
      templates.find((t) => t.id === $("template").value) || templates[0],
    format = $("new-format").value;
  let content = template.content;
  if (format === "visual") {
    const article = document.createElement("article");
    article.append(renderMarkdown(content));
    content = sanitizeVisual(article.innerHTML);
  }
  if (template.id === "blank" && format === "xml")
    content =
      '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n  <title>New document</title>\n</document>\n';
  if (template.id === "blank" && format === "dita")
    content =
      '<?xml version="1.0" encoding="UTF-8"?>\n<concept id="new-concept">\n  <title>New concept</title>\n  <conbody>\n    <p>Explain the concept here.</p>\n  </conbody>\n</concept>\n';
  const doc = makeDocument(
    uniqueTitle(template.title),
    content,
    "",
    format,
    template.id === "blank" ? "" : template.id,
  );
  if (template.id === "xml-manifest") doc.schemaId = "release-manifest";
  const saved = await store.save(doc);
  documents.push(saved);
  setActive(saved);
  $("new-dialog").close();
  closeMobileNav();
  $("doc-title").focus();
  $("doc-title").select();
  notice(
    "Created an independent local copy. Saving does not download or publish it.",
  );
}
function confirmAction(title, message, label) {
  return new Promise((resolve) => {
    const d = $("confirm-dialog");
    $("dialog-title").textContent = title;
    $("dialog-message").textContent = message;
    $("dialog-confirm").textContent = label;
    d.returnValue = "cancel";
    d.addEventListener("close", () => resolve(d.returnValue === "confirm"), {
      once: true,
    });
    d.showModal();
  });
}
async function deleteDocument() {
  if (!active || !(await flush())) return;
  if (
    !(await confirmAction(
      "Delete this document?",
      `Delete “${displayTitle(active)}” from this browser? Download it first if you need a copy.`,
      "Delete document",
    ))
  )
    return;
  await store.remove(active);
  documents = await store.list();
  setActive(documents[0] || null);
  notice("Document deleted locally.");
}
function download(content, name, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = node("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function visualHTML(doc) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Exported SiloV document</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font:16px/1.7 system-ui,sans-serif;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{border:1px solid #777;padding:8px}img{max-width:100%;height:auto}pre{white-space:pre-wrap;background:#eee;padding:16px}blockquote{border-left:3px solid #17664f;padding-left:16px}</style></head><body>${sanitizeVisual(doc.content)}</body></html>`;
}
function exportNative() {
  if (!active) return;
  download(
    active.format === "visual" ? visualHTML(active) : active.content,
    fileName(displayTitle(active), extensions[active.format]),
    active.format === "visual"
      ? "text/html;charset=utf-8"
      : active.format === "markdown"
        ? "text/markdown;charset=utf-8"
        : "application/xml;charset=utf-8",
  );
  notice(
    "Download started with current editor content. This does not publish the document.",
  );
}
async function importDocument(file) {
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) throw new Error("Import is limited to 2 MB.");
  const extension = file.name.split(".").at(-1).toLowerCase(),
    format = {
      md: "markdown",
      txt: "markdown",
      xml: "xml",
      dita: "dita",
      html: "visual",
    }[extension];
  if (!format) throw new Error("Choose .md, .txt, .xml, .dita, or .html.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(
    await file.arrayBuffer(),
  );
  if (text.length > MAX_CONTENT || text.includes("\0"))
    throw new Error(
      "Import must be UTF-8 text within the 1,000,000-character limit.",
    );
  if (
    format === "visual" &&
    !(await confirmAction(
      "Import HTML as a visual copy?",
      "Unsupported styles and structures may be normalized. Remote images and active content are removed. The complete original HTML will be retained for download and backup.",
      "Import and retain original",
    ))
  )
    return;
  if (!(await flush())) return;
  documents = await store.list();
  if (documents.length >= MAX_DOCUMENTS)
    throw new Error("Document limit reached.");
  const doc = makeDocument(
    uniqueTitle(
      file.name.replace(/\.[^.]+$/, "").slice(0, 180) || "Imported document",
    ),
    format === "visual" ? sanitizeVisual(text) : text,
    "",
    format,
  );
  if (format === "visual") doc.originalSource = text;
  const saved = await store.save(doc);
  documents.push(saved);
  setActive(saved);
  closeMobileNav();
  notice("Imported as a new local document. Existing documents are unchanged.");
}
async function backup() {
  if (!store)
    throw new Error(
      "Local storage is unavailable. Download the current document instead.",
    );
  await flush();
  const all = await store.list(),
    snapshot = [...all];
  if (dirty && active) {
    if (all.length >= MAX_DOCUMENTS)
      throw new Error(
        "Download the unsaved document first; backup cannot exceed 500 documents.",
      );
    snapshot.push({
      ...active,
      id: crypto.randomUUID(),
      revision: 0,
      title: displayTitle(active).slice(0, 175) + " (unsaved draft)",
    });
  }
  download(
    backupJSON(snapshot),
    "silov-backup-" + new Date().toISOString().slice(0, 10) + ".json",
    "application/json",
  );
  notice(
    dirty
      ? "Backup includes stored documents and a separate unsaved recovery copy. Saving still needs attention."
      : "Backup downloaded with document types, source, and retained originals. Keep it somewhere safe.",
  );
}
async function restore(file) {
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds 10 MB.");
  const incoming = parseBackup(await file.text());
  if (!incoming.length) throw new Error("This backup has no documents.");
  if (!(await flush())) return;
  documents = await store.list();
  if (documents.length + incoming.length > MAX_DOCUMENTS)
    throw new Error("Restore would exceed 500 documents.");
  if (
    !(await confirmAction(
      "Restore backup as copies?",
      `Add ${incoming.length} documents? Existing documents are preserved, with new IDs and unique titles for restored copies.`,
      "Restore copies",
    ))
  )
    return;
  const copies = await store.addCopies(restoredCopies(incoming, documents));
  documents = await store.list();
  setActive(copies[0]);
  closeMobileNav();
  notice(`Restored ${copies.length} documents as new copies.`);
}
async function init() {
  try {
    store = await openStore();
    documents = await store.list();
    for (const id of ["create", "new-document", "welcome-create"])
      $(id).disabled = false;
    const last = preferences.get("active");
    setActive(documents.find((d) => d.id === last) || documents[0] || null);
    clearError();
  } catch (error) {
    store = null;
    $("document-list").textContent =
      "Local storage is unavailable. Retry storage to reopen your library.";
    showError(error);
  }
}
for (const id of ["new-document", "welcome-create"])
  $(id).onclick = () => {
    if (!store || busy) return;
    renderTemplateOptions();
    $("new-dialog").showModal();
    $("new-format").focus();
  };
$("new-format").onchange = renderTemplateOptions;
$("template").onchange = templateSummary;
$("cancel-new").onclick = () => $("new-dialog").close();
$("create").onclick = () => operation(createDocument);
$("doc-title").oninput = edit;
$("doc-collection").oninput = edit;
$("search-docs").oninput = renderNavigation;
$("collection-filter").onchange = renderNavigation;
$("panel").onchange = panel;
$("review-toggle").onclick = () => {
  const closed = $("workspace").classList.toggle("panel-closed");
  $("review-toggle").setAttribute("aria-expanded", String(!closed));
  editor?.source?.requestMeasure();
};
for (const b of document.querySelectorAll("[data-view]"))
  b.onclick = () => setView(b.dataset.view);
for (const b of document.querySelectorAll("[data-command]")) {
  b.onmousedown = (e) => e.preventDefault();
  b.onclick = () => {
    editor?.command(b.dataset.command);
    selectionChanged();
  };
}
$("undo").onclick = () => editor?.command("undo");
$("redo").onclick = () => editor?.command("redo");
$("block-style").onchange = () =>
  editor?.heading(Number($("block-style").value));
$("find").onclick = () => {
  if (active?.format === "visual") {
    $("visual-search").hidden = false;
    $("find-text").focus();
  } else editor?.command("find");
};
for (const b of document.querySelectorAll("[data-search]"))
  b.onclick = () => {
    $("find-status").textContent = editor.find(
      $("find-text").value,
      $("replace-text").value,
      b.dataset.search,
    )
      ? "Match updated."
      : "No matching selection.";
  };
$("find-text").oninput = () =>
  editor?.find($("find-text").value, $("replace-text").value, "next");
$("close-search").onclick = () => {
  $("visual-search").hidden = true;
  editor?.focus();
};
$("link").onclick = () => {
  $("link-url").value = editor?.visual?.getAttributes("link").href || "";
  $("link-dialog").showModal();
  $("link-url").focus();
};
$("cancel-link").onclick = () => $("link-dialog").close();
$("apply-link").onclick = () => {
  const url = $("link-url").value.trim();
  try {
    if (url) {
      const parsed = new URL(url, location.href);
      if (
        !["http:", "https:", "mailto:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        /[\u0000-\u0020\u007f]/.test(url)
      )
        throw new Error(
          "Use an HTTP(S), mailto, or relative URL without credentials or spaces.",
        );
    }
    editor.link(url);
    $("link-dialog").close();
  } catch (e) {
    $("link-dialog").close();
    showError(e);
  }
};
$("image").onclick = () => {
  $("image-error").textContent = "";
  $("image-dialog").showModal();
  $("image-alt").focus();
};
$("cancel-image").onclick = () => $("image-dialog").close();
$("insert-image").onclick = () =>
  operation(async () => {
    const file = $("image-file").files[0],
      alt = $("image-alt").value.trim();
    if (!file || !alt) throw new Error("Choose an image and provide alt text.");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > MAX_IMAGE_BYTES
    )
      throw new Error("Use PNG, JPEG, or WebP up to 200 KB.");
    if ((active.content.match(/<img\b/g) || []).length >= MAX_IMAGES)
      throw new Error("A document can contain at most three images.");
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (active.content.length + data.length + alt.length + 100 > MAX_CONTENT)
      throw new Error("This image would exceed the document limit.");
    editor.visual.chain().focus().setImage({ src: data, alt }).run();
    $("image-dialog").close();
    $("image-file").value = "";
    $("image-alt").value = "";
  });
$("schema").onchange = () => {
  if (active) {
    active.schemaId = $("schema").value;
    edit();
    renderContent();
  }
};
$("validate").onclick = renderContent;
$("insert-element").onclick = () => {
  if (!editor.insertDita($("dita-element").value))
    notice(
      "Place the cursor inside an element with a closing tag, or select it in the outline.",
    );
};
$("delete").onclick = () => operation(deleteDocument);
$("export-md").onclick = exportNative;
$("recover-md").onclick = exportNative;
$("export-html").onclick = () => {
  if (active)
    download(
      active.format === "visual" ? visualHTML(active) : exportHTML(active),
      fileName(displayTitle(active), ".html"),
      "text/html",
    );
};
$("export-original").onclick = () => {
  if (active?.originalSource !== undefined)
    download(
      active.originalSource,
      fileName(displayTitle(active) + " original", ".html.txt"),
      "text/plain;charset=utf-8",
    );
};
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(active.content);
    notice("Source copied.");
  } catch {
    showError(
      new Error("Clipboard access denied. Download the document instead."),
    );
  }
};
$("import").onclick = () => $("import-file").click();
$("restore").onclick = () => $("restore-file").click();
$("import-file").onchange = (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  operation(() => importDocument(file));
};
$("restore-file").onchange = (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  operation(() => restore(file));
};
$("backup").onclick = () => operation(backup);
$("retry").onclick = () =>
  operation(async () => {
    if (!store) return init();
    if (await flush()) clearError();
  });
$("save-copy").onclick = () =>
  operation(async () => {
    if (!active || !store) return;
    const draft = { ...active };
    documents = await store.list();
    if (documents.length >= MAX_DOCUMENTS)
      throw new Error("Document limit reached. Download this draft.");
    const saved = await store.save({
      ...draft,
      id: crypto.randomUUID(),
      revision: 0,
      title: uniqueTitle(displayTitle(draft).slice(0, 175) + " (copy)"),
    });
    documents.push(saved);
    setActive(saved);
    clearError();
    notice("Saved a new copy; the other version was not overwritten.");
  });
$("toggle-nav").onclick = () => {
  const open = $("sidebar").classList.toggle("is-open");
  $("toggle-nav").setAttribute("aria-expanded", String(open));
};
function setTheme(theme) {
  theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  $("theme").textContent = theme === "dark" ? "Light theme" : "Dark theme";
  $("theme").setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
  preferences.set("theme", theme);
}
$("theme").onclick = () =>
  setTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    flush();
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "f" &&
    editor?.visual &&
    $("editor-host").contains(event.target)
  ) {
    event.preventDefault();
    $("find").click();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (dirty || saving) {
    event.preventDefault();
    event.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && dirty) flush();
});
$("preview").onclick = (event) => {
  const link = event.target.closest("a");
  if (link?.getAttribute("href")?.startsWith("#")) {
    event.preventDefault();
    try {
      document
        .getElementById(decodeURIComponent(link.getAttribute("href").slice(1)))
        ?.scrollIntoView({ block: "nearest" });
    } catch {
      /* Malformed links are reported by review */
    }
  }
};
setTheme(
  preferences.get(
    "theme",
    matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
  ),
);
setView(preferences.get("view", "split"));
panel();
init();
