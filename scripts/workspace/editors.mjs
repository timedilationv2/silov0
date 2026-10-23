import {
  VisualEditor,
  StarterKit,
  TableKit,
  Image,
  Extension,
  visualSearch,
  SearchQuery,
  setSearchState,
  findNext,
  findPrev,
  replaceCurrent,
  replaceAll,
  basicSetup,
  EditorView,
  EditorState,
  keymap,
  indentWithTab,
  indentMore,
  indentLess,
  undo,
  redo,
  markdown,
  xml,
  GFM,
  openSearchPanel,
  setDiagnostics,
  syntaxTree,
  HighlightStyle,
  syntaxHighlighting,
  tags,
  Decoration,
  ViewPlugin,
} from "../../assets/vendor/editors.js";
import DOMPurify from "../../assets/vendor/purify.es.mjs";
import { ditaCompletions, ditaElements } from "./validation.mjs";
import { MAX_CONTENT, MAX_IMAGE_BYTES, MAX_IMAGES } from "./model.mjs";

export function sanitizeVisual(source) {
  const fragment = DOMPurify.sanitize(source, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
      "br",
      "hr",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "src",
      "alt",
      "start",
      "colspan",
      "rowspan",
    ],
  });
  let count = 0;
  for (const image of fragment.querySelectorAll("img")) {
    const src = image.getAttribute("src") || "";
    if (
      !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(src) ||
      src.length * 0.75 > MAX_IMAGE_BYTES + 100 ||
      !image.getAttribute("alt")?.trim() ||
      ++count > MAX_IMAGES
    ) {
      image.replaceWith(
        document.createTextNode(
          "[Image omitted: requires local PNG/JPEG/WebP, alt text, and size limits.]",
        ),
      );
    }
  }
  for (const a of fragment.querySelectorAll("a")) {
    try {
      const url = new URL(a.getAttribute("href"), "https://local.invalid/");
      if (
        !["https:", "http:", "mailto:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        a.removeAttribute("href");
    } catch {
      a.removeAttribute("href");
    }
    a.setAttribute("rel", "noopener noreferrer");
  }
  const div = document.createElement("div");
  div.append(fragment);
  return div.innerHTML;
}
const matchingTags = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.update({ view });
    }
    update({ view }) {
      const marks = [];
      let node = syntaxTree(view.state).resolveInner(
        view.state.selection.main.head,
        -1,
      );
      while (node && node.name !== "Element") node = node.parent;
      if (node)
        for (const name of ["OpenTag", "CloseTag"]) {
          const tag = node.getChild(name);
          const text = tag?.getChild("TagName");
          if (text)
            marks.push(
              Decoration.mark({ class: "matching-tag" }).range(
                text.from,
                text.to,
              ),
            );
        }
      this.decorations = Decoration.set(marks, true);
    }
  },
  { decorations: (v) => v.decorations },
);

export function mountEditor(host, doc, onChange, onSelection) {
  let visual,
    source,
    loading = false;
  host.replaceChildren();
  if (doc.format === "visual") {
    visual = new VisualEditor({
      element: host,
      extensions: [
        StarterKit.configure({
          link: { openOnClick: false, autolink: false, linkOnPaste: false },
          heading: { levels: [1, 2, 3, 4, 5, 6] },
        }),
        TableKit.configure({ table: { resizable: false } }),
        Image.extend({
          addInputRules() {
            return [];
          },
        }).configure({ allowBase64: true }),
        Extension.create({
          name: "documentSearch",
          addProseMirrorPlugins() {
            return [visualSearch()];
          },
        }),
      ],
      content: sanitizeVisual(doc.content),
      editorProps: {
        attributes: {
          "aria-label": "Visual document editor",
          role: "textbox",
          "aria-multiline": "true",
          spellcheck: "true",
        },
        transformPastedHTML: sanitizeVisual,
        // Tiptap sanitizes schema-unsupported nodes; refuse oversized native transactions.
        handlePaste: (_, event) => {
          if (event.clipboardData?.files.length) {
            onChange(
              null,
              new Error(
                "Use Insert image to set alt text and enforce image limits.",
              ),
            );
            return true;
          }
          return false;
        },
        handleDOMEvents: {
          drop: (_, event) => {
            if (event.dataTransfer?.files.length) {
              event.preventDefault();
              onChange(
                null,
                new Error("Use Insert image instead of dropping files."),
              );
              return true;
            }
            return false;
          },
        },
      },
      onUpdate: () => {
        if (!loading) onChange(visual.getHTML());
      },
      onSelectionUpdate: () => onSelection?.(),
    });
    // Reject transactions over the common content limit before the document changes.
    visual.registerPlugin(
      new (visualSearch().constructor)({
        filterTransaction: (tr) => {
          if (!tr.docChanged) return true;
          let images = 0;
          tr.doc.descendants((n) => {
            if (n.type.name === "image") images++;
          });
          if (
            JSON.stringify(tr.doc.toJSON()).length > MAX_CONTENT ||
            images > MAX_IMAGES
          ) {
            onChange(
              null,
              new Error(
                "Change rejected: document size or three-image limit exceeded.",
              ),
            );
            return false;
          }
          return true;
        },
      }),
    );
  } else {
    const format = doc.format;
    const wrap =
      (before, after = before) =>
      (view) => {
        const { from, to } = view.state.selection.main;
        const selected = view.state.sliceDoc(from, to);
        view.dispatch({
          changes: { from, to, insert: before + selected + after },
          selection: { anchor: from + before.length, head: to + before.length },
        });
        return true;
      };
    source = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: doc.content,
        extensions: [
          basicSetup,
          syntaxHighlighting(
            HighlightStyle.define([
              {
                tag: [tags.keyword, tags.tagName, tags.typeName],
                color: "var(--syntax-keyword)",
              },
              {
                tag: [tags.string, tags.attributeValue, tags.url],
                color: "var(--syntax-string)",
              },
              { tag: tags.comment, color: "var(--syntax-comment)" },
              { tag: tags.attributeName, color: "var(--text)" },
              { tag: tags.heading, fontWeight: "700" },
              { tag: tags.strong, fontWeight: "700" },
              { tag: tags.emphasis, fontStyle: "italic" },
              { tag: tags.link, textDecoration: "underline" },
            ]),
          ),
          EditorView.lineWrapping,
          format === "markdown"
            ? markdown({ extensions: [GFM] })
            : xml({
                elements: format === "dita" ? ditaCompletions : undefined,
              }),
          ...(format === "markdown" ? [] : [matchingTags]),
          keymap.of([
            { key: "Tab", run: indentWithTab.run, shift: indentLess },
            ...(format === "markdown"
              ? [
                  { key: "Mod-b", run: wrap("**") },
                  { key: "Mod-i", run: wrap("_") },
                  {
                    key: "Mod-k",
                    run: wrap("[", "](https://example.invalid)"),
                  },
                ]
              : []),
          ]),
          EditorState.changeFilter.of((tr) => {
            if (tr.newDoc.length > MAX_CONTENT) {
              onChange(
                null,
                new Error(
                  "Change rejected: the document exceeds 1,000,000 characters.",
                ),
              );
              return false;
            }
            return true;
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !loading)
              onChange(update.state.doc.toString());
            if (update.selectionSet) onSelection?.();
          }),
          EditorView.contentAttributes.of({
            "aria-label":
              format === "markdown"
                ? "Markdown source editor"
                : format === "dita"
                  ? "DITA source editor"
                  : "XML source editor",
            spellcheck: "false",
          }),
          EditorView.theme({
            "&": { color: "var(--text)", backgroundColor: "var(--editor)" },
            ".cm-content": {
              fontFamily: "ui-monospace,monospace",
              fontSize: "14px",
              lineHeight: "1.8",
              padding: "20px 0",
            },
            ".cm-gutters": {
              backgroundColor: "var(--raised)",
              color: "var(--muted)",
              borderColor: "var(--border)",
            },
            ".cm-cursor": { borderLeftColor: "var(--text)" },
            ".cm-selectionBackground": {
              backgroundColor: "#78a69455!important",
            },
            "&.cm-focused .cm-selectionBackground": {
              backgroundColor: "#78a69466",
            },
            ".cm-panels": { background: "var(--raised)", color: "var(--text)" },
            ".cm-textfield": {
              background: "var(--editor)",
              color: "var(--text)",
            },
            ".cm-activeLine": { backgroundColor: "#78a69415" },
          }),
        ],
      }),
    });
  }
  const adapter = {
    visual,
    source,
    content: () => (visual ? visual.getHTML() : source.state.doc.toString()),
    destroy: () => {
      visual?.destroy();
      source?.destroy();
    },
    focus: () => (visual ? visual.commands.focus() : source.focus()),
    selectLine(line, column = 1) {
      if (!source) return;
      const l = source.state.doc.line(
        Math.max(1, Math.min(line, source.state.doc.lines)),
      );
      const pos = Math.min(l.to, l.from + column - 1);
      source.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      source.focus();
    },
    diagnostics(findings) {
      if (!source) return;
      const ds = findings.map((f) => {
        const line = source.state.doc.line(
          Math.max(1, Math.min(f.line || 1, source.state.doc.lines)),
        );
        return {
          from: Math.min(line.to, line.from + (f.column || 1) - 1),
          to: line.to,
          severity: f.severity || "warning",
          message: f.message,
        };
      });
      source.dispatch(setDiagnostics(source.state, ds));
    },
    command(name) {
      if (visual) {
        const c = visual.chain().focus();
        const commands = {
          bold: () => c.toggleBold(),
          italic: () => c.toggleItalic(),
          underline: () => c.toggleUnderline(),
          inlineCode: () => c.toggleCode(),
          bullet: () => c.toggleBulletList(),
          ordered: () => c.toggleOrderedList(),
          indent: () => c.sinkListItem("listItem"),
          outdent: () => c.liftListItem("listItem"),
          quote: () => c.toggleBlockquote(),
          codeBlock: () => c.toggleCodeBlock(),
          undo: () => c.undo(),
          redo: () => c.redo(),
          table: () => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
          row: () => c.addRowAfter(),
          column: () => c.addColumnAfter(),
          deleteRow: () => c.deleteRow(),
          deleteColumn: () => c.deleteColumn(),
          deleteTable: () => c.deleteTable(),
        };
        return commands[name]?.().run();
      }
      if (name === "undo") return undo(source);
      if (name === "redo") return redo(source);
      if (name === "indent") return indentMore(source);
      if (name === "outdent") return indentLess(source);
      if (name === "find") return openSearchPanel(source);
      const patterns = {
        bold: ["**", "**"],
        italic: ["_", "_"],
        inlineCode: ["`", "`"],
        bullet: ["\n- ", ""],
        ordered: ["\n1. ", ""],
        quote: ["\n> ", ""],
        codeBlock: ["\n```text\n", "\n```\n"],
        table: [
          "\n| Column | Value |\n| --- | --- |\n| Name | Example |\n",
          "",
        ],
      };
      if (patterns[name]) {
        const [a, b] = patterns[name];
        const { from, to } = source.state.selection.main;
        source.dispatch({
          changes: {
            from,
            to,
            insert: a + source.state.sliceDoc(from, to) + b,
          },
          selection: { anchor: from + a.length, head: to + a.length },
          scrollIntoView: true,
        });
        source.focus();
      }
    },
    heading(level) {
      if (visual)
        return level
          ? visual.chain().focus().toggleHeading({ level }).run()
          : visual.chain().focus().setParagraph().run();
      const line = source.state.doc.lineAt(source.state.selection.main.head);
      source.dispatch({
        changes: {
          from: line.from,
          to: line.to,
          insert:
            (level ? "#".repeat(level) + " " : "") +
            line.text.replace(/^#{1,6}\s+/, ""),
        },
      });
      source.focus();
    },
    link(url) {
      if (visual)
        return url
          ? visual
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run()
          : visual.chain().focus().unsetLink().run();
      const { from, to } = source.state.selection.main;
      source.dispatch({
        changes: {
          from,
          to,
          insert: `[${source.state.sliceDoc(from, to) || "Link"}](${url})`,
        },
      });
    },
    find(query, replacement, action = "next") {
      if (!visual) return openSearchPanel(source);
      visual.view.dispatch(
        setSearchState(
          visual.state.tr,
          new SearchQuery({
            search: query,
            replace: replacement,
            literal: true,
          }),
        ),
      );
      const commands = {
        next: findNext,
        previous: findPrev,
        replace: replaceCurrent,
        all: replaceAll,
      };
      return commands[action](visual.state, visual.view.dispatch);
    },
    outline() {
      if (visual) {
        const entries = [];
        visual.state.doc.descendants((n, pos) => {
          if (n.type.name === "heading")
            entries.push({
              text: n.textContent,
              level: n.attrs.level,
              go: () =>
                visual
                  .chain()
                  .focus()
                  .setTextSelection(pos + 1)
                  .run(),
            });
        });
        return entries;
      }
      const text = source.state.doc.toString();
      if (doc.format === "markdown") {
        const entries = [];
        syntaxTree(source.state).iterate({
          enter: (n) => {
            const match = /^(?:ATX|Setext)Heading([1-6])$/.exec(n.name);
            if (match) {
              const from = n.from,
                to = n.to;
              entries.push({
                text: text
                  .slice(from, to)
                  .replace(/^#{1,6}\s+/, "")
                  .replace(/\n[=-]+\s*$/, "")
                  .trim(),
                level: Number(match[1]),
                go: () => {
                  source.dispatch({
                    selection: { anchor: from },
                    scrollIntoView: true,
                  });
                  source.focus();
                },
              });
            }
          },
        });
        return entries;
      }
      const entries = [];
      syntaxTree(source.state).iterate({
        enter: (n) => {
          if (n.name === "Element") {
            const element = n.node;
            const m = /^<([\w:.-]+)/.exec(text.slice(element.from));
            let level = 0;
            for (let parent = element; parent; parent = parent.parent)
              if (parent.name === "Element") level++;
            if (m)
              entries.push({
                text: m[1],
                level,
                go: () => {
                  const close = element.getChild("CloseTag");
                  source.dispatch({
                    selection: { anchor: close?.from ?? element.from },
                    scrollIntoView: true,
                  });
                  source.focus();
                  onSelection?.();
                },
              });
          }
        },
      });
      return entries;
    },
    context() {
      if (!source || doc.format !== "dita") return null;
      let n = syntaxTree(source.state).resolveInner(
        source.state.selection.main.head,
        -1,
      );
      while (n && n.name !== "Element") n = n.parent;
      if (!n) return null;
      const text = source.state.doc.toString(),
        tag = /^<([\w:.-]+)/.exec(text.slice(n.from))?.[1];
      const actual = n.getChildren("Element").map((child) => ({
        tag: /^<([\w:.-]+)/.exec(text.slice(child.from))?.[1],
        node: child,
      }));
      const once =
        {
          concept: ["title", "shortdesc", "conbody"],
          task: ["title", "shortdesc", "taskbody"],
          reference: ["title", "shortdesc", "refbody"],
          taskbody: ["prereq", "context", "steps", "result", "postreq"],
          step: ["cmd", "info", "substeps", "stepresult"],
          substep: ["cmd", "info", "stepresult"],
          section: ["title"],
        }[tag] || [];
      const children = n.getChild("CloseTag")
        ? (ditaElements[tag] || []).filter(
            (name) =>
              !once.includes(name) || !actual.some((c) => c.tag === name),
          )
        : [];
      return {
        tag,
        node: n,
        children,
        actual,
        ordered: [
          "concept",
          "task",
          "reference",
          "taskbody",
          "step",
          "substep",
          "section",
        ].includes(tag),
      };
    },
    insertDita(name) {
      const context = this.context();
      if (!context?.children.includes(name)) return false;
      const close = context.node.getChild("CloseTag");
      if (!close) return false;
      const snippets = {
        section:
          "<section>\n<title>New section</title>\n<p>Describe one aspect of the topic.</p>\n</section>",
        step: "<step><cmd>Describe the next action.</cmd></step>",
        substep: "<substep><cmd>Describe a supporting action.</cmd></substep>",
        steps: "<steps><step><cmd>Describe the action.</cmd></step></steps>",
        ul: "<ul><li>First item</li></ul>",
        ol: "<ol><li>First item</li></ol>",
        li: "<li>New item</li>",
        prereq: "<prereq><p>Describe required access.</p></prereq>",
        context: "<context><p>Explain when to perform this task.</p></context>",
        result: "<result><p>Describe the expected result.</p></result>",
        info: "<info><p>Explain how to complete the command.</p></info>",
      };
      const insert =
        "\n" +
        (snippets[name] ||
          `<${name}>${name === "xref" ? "Related topic" : "New text"}</${name}>`) +
        "\n";
      const order = ditaElements[context.tag] || [];
      const later = context.ordered
        ? context.actual.find((c) => order.indexOf(c.tag) > order.indexOf(name))
        : null;
      const position = later?.node.from ?? close.from;
      source.dispatch({
        changes: { from: position, insert },
        selection: { anchor: position + 1 },
        scrollIntoView: true,
      });
      source.focus();
      return true;
    },
  };
  return adapter;
}
