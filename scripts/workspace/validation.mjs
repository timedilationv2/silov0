import { validateXML } from "../../assets/vendor/xmllint/index-browser.mjs";

// DITA 1.3 topic subset, intentionally smaller than the OASIS grammar.
// This table drives completion and insertion as well as custom structural checks.
const inline = ["ph", "b", "i", "u", "codeph", "xref"];
export const ditaElements = {
  concept: ["title", "shortdesc", "conbody"],
  task: ["title", "shortdesc", "taskbody"],
  reference: ["title", "shortdesc", "refbody"],
  conbody: ["p", "section", "note", "ul", "ol", "codeblock"],
  taskbody: ["prereq", "context", "steps", "result", "postreq"],
  refbody: ["section"],
  section: ["title", "p", "note", "ul", "ol", "codeblock"],
  prereq: ["p", "ul", "ol"],
  context: ["p", "ul", "ol"],
  result: ["p", "ul", "ol"],
  postreq: ["p", "ul", "ol"],
  steps: ["step"],
  step: ["cmd", "info", "substeps", "stepresult"],
  substeps: ["substep"],
  substep: ["cmd", "info", "stepresult"],
  info: ["p", "note", "ul", "ol", "codeblock"],
  stepresult: ["p"],
  ul: ["li"],
  ol: ["li"],
  li: ["p", "ul", "ol", ...inline],
  title: inline,
  shortdesc: inline,
  p: inline,
  cmd: inline,
  note: ["p", ...inline],
  codeblock: [],
  codeph: [],
  ph: inline,
  b: inline,
  i: inline,
  u: inline,
  xref: inline,
};
export const ditaCompletions = Object.entries(ditaElements).map(
  ([name, children]) => ({
    name,
    children,
    top: ["concept", "task", "reference"].includes(name),
    attributes: ["id", ...(name === "xref" ? ["href"] : [])],
  }),
);
export function sourceLocation(source, offset) {
  const lines = source.slice(0, offset).split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}
export function forbiddenXML(source) {
  const match = /<!\s*(DOCTYPE|ENTITY)\b/i.exec(source);
  return match
    ? {
        ...sourceLocation(source, match.index),
        severity: "error",
        message:
          "DTD and entity declarations are disabled. No external resources are resolved. The original source is retained.",
      }
    : null;
}
function diagnostic(message, source, element) {
  // Traversal follows source order; opening-tag offsets are attached by parseXMLTree.
  return {
    message,
    severity: "error",
    ...sourceLocation(source, element?._sourceOffset || 0),
  };
}
export function parseXMLTree(source) {
  if (forbiddenXML(source)) return null;
  const parsed = new DOMParser().parseFromString(source, "application/xml");
  if (parsed.querySelector("parsererror")) return null;
  const tags = [
    ...source.matchAll(
      /<!--[^]*?-->|<!\[CDATA\[[^]*?\]\]>|<([A-Za-z_][\w:.-]*)\b[^>]*>/g,
    ),
  ].filter((m) => m[1]);
  const elements = [
    parsed.documentElement,
    ...parsed.documentElement.querySelectorAll("*"),
  ];
  elements.forEach((el, i) => {
    el._sourceOffset = tags[i]?.index || 0;
  });
  return parsed;
}
export function checkDita(source, parsed = parseXMLTree(source)) {
  if (!parsed) return [];
  const root = parsed.documentElement,
    findings = [];
  const add = (message, element = root) =>
    findings.push(diagnostic(message, source, element));
  const roots = { concept: "conbody", task: "taskbody", reference: "refbody" };
  if (!roots[root.tagName]) {
    add("Expected a DITA 1.3 concept, task, or reference root.");
    return findings;
  }
  const ids = new Set();
  for (const el of [root, ...root.querySelectorAll("*")]) {
    const name = el.tagName,
      children = [...el.children].map((c) => c.tagName);
    if (!Object.hasOwn(ditaElements, name)) {
      add(`Element <${name}> is outside the supported DITA subset.`, el);
      continue;
    }
    for (const child of el.children)
      if (!ditaElements[name].includes(child.tagName))
        add(
          `<${child.tagName}> is not permitted inside <${name}> in this subset.`,
          child,
        );
    if (
      ![
        "title",
        "shortdesc",
        "p",
        "cmd",
        "note",
        "li",
        ...inline,
        "codeblock",
      ].includes(name) &&
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    )
      add(`Text in <${name}> must be inside a permitted child element.`, el);
    for (const attr of el.attributes)
      if (
        ![
          "id",
          "xml:lang",
          ...(name === "xref" ? ["href"] : []),
          ...(name === "note" ? ["type"] : []),
        ].includes(attr.name)
      )
        add(`Attribute ${attr.name} is outside the supported subset.`, el);
    if (el.hasAttribute("id")) {
      const id = el.getAttribute("id");
      if (!/^[A-Za-z_][\w.-]*$/.test(id) || ids.has(id))
        add("IDs must be unique XML names.", el);
      ids.add(id);
    }
    if (["title", "shortdesc", "cmd"].includes(name) && !el.textContent.trim())
      add(`<${name}> must contain text.`, el);
    const once = (names) => {
      for (const n of names)
        if (children.filter((c) => c === n).length > 1)
          add(`Only one <${n}> is permitted in <${name}>.`, el);
    };
    const required = (n) => {
      if (!children.includes(n)) add(`<${name}> requires <${n}>.`, el);
    };
    const order = (names) => {
      let prior = -1;
      for (const child of children) {
        const n = names.indexOf(child);
        if (n >= 0 && n < prior)
          add(
            `Children of <${name}> must be ordered: ${names.join(", ")}.`,
            el,
          );
        prior = Math.max(prior, n);
      }
    };
    if (roots[name]) {
      required("title");
      required(roots[name]);
      once(["title", "shortdesc", roots[name]]);
      order(["title", "shortdesc", roots[name]]);
      if (!el.id) add("A topic requires an id attribute.", el);
    }
    if (name === "taskbody") {
      required("steps");
      once(ditaElements[name]);
      order(ditaElements[name]);
    }
    if (["steps", "substeps", "ul", "ol"].includes(name) && !el.children.length)
      add(`<${name}> requires at least one child.`, el);
    if (["step", "substep"].includes(name)) {
      required("cmd");
      once(ditaElements[name]);
      order(ditaElements[name]);
    }
    if (name === "section") {
      once(["title"]);
      if (children.includes("title") && children[0] !== "title")
        add("A section title must be its first child.", el);
    }
  }
  return findings;
}
function xmlFindings(result) {
  const lines = result.rawOutput.split("\n"),
    findings = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^document\.xml:(\d+):\s*(.*)/.exec(lines[i]);
    if (!match) continue;
    const caret = lines[i + 2]?.indexOf("^") ?? -1;
    findings.push({
      severity: "error",
      line: Number(match[1]),
      column: caret >= 0 ? caret + 1 : 1,
      message: match[2],
    });
  }
  return findings.length
    ? findings
    : result.errors.map((e) => ({
        severity: "error",
        message: e.message,
        line: e.loc?.lineNumber || 1,
        column: 1,
      }));
}
let schemaPromise;
export async function validateSource(source, format, schema = "none") {
  const blocked = forbiddenXML(source);
  if (blocked)
    return {
      scope: "XML safety policy; parsing blocked",
      findings: [blocked],
      parsed: null,
    };
  // Non-network parser in a disposable worker; no DTD/entity expansion or XInclude.
  const options = {
    xml: [{ fileName: "document.xml", contents: source }],
    modifyArguments: (args) => ["--nonet", ...args],
    maxMemoryPages: 512,
  };
  let result;
  try {
    result = await validateXML(options);
  } catch (error) {
    const raw = error.message || String(error);
    const match = /document\.xml:(\d+):/.exec(raw);
    const lines = raw.split("\n"),
      caret = lines.findIndex((l) => /^\s*\^/.test(l));
    return {
      scope: "XML well-formedness",
      findings: [
        {
          severity: "error",
          message: raw.slice(0, 1600),
          line: Number(match?.[1] || 1),
          column: caret >= 0 ? lines[caret].indexOf("^") + 1 : 1,
        },
      ],
      parsed: null,
    };
  }
  if (!result.valid)
    return {
      scope: "XML well-formedness",
      findings: xmlFindings(result),
      parsed: null,
    };
  const parsed = parseXMLTree(source);
  if (format === "dita")
    return {
      scope:
        "XML well-formedness + custom DITA 1.3 subset checks (not OASIS grammar validation)",
      findings: checkDita(source, parsed),
      parsed,
    };
  if (schema === "release-manifest") {
    schemaPromise ||= fetch(
      new URL("../../assets/schemas/release-manifest.xsd", import.meta.url),
    ).then((r) => {
      if (!r.ok) throw new Error("Bundled schema could not be loaded");
      return r.text();
    });
    const xsd = await schemaPromise;
    result = await validateXML({
      ...options,
      schema: [{ fileName: "release-manifest.xsd", contents: xsd }],
    });
    return {
      scope: "XML well-formedness + release-manifest.xsd 1.0 validation",
      parsed,
      findings: xmlFindings(result),
    };
  }
  return {
    scope: "XML well-formedness only (no schema selected)",
    findings: [],
    parsed,
  };
}
