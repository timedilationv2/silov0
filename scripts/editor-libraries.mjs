// This entry point is bundled locally by scripts/vendor.mjs.
export { Editor as VisualEditor } from "@tiptap/core";
export { default as StarterKit } from "@tiptap/starter-kit";
export { TableKit } from "@tiptap/extension-table";
export { default as Image } from "@tiptap/extension-image";
export { basicSetup } from "codemirror";
export { EditorView, keymap } from "@codemirror/view";
export { EditorState } from "@codemirror/state";
export {
  indentWithTab,
  indentMore,
  indentLess,
  undo,
  redo,
} from "@codemirror/commands";
export { markdown } from "@codemirror/lang-markdown";
export { xml } from "@codemirror/lang-xml";
export { syntaxTree } from "@codemirror/language";
export { openSearchPanel } from "@codemirror/search";
export { setDiagnostics } from "@codemirror/lint";
export { Extension } from "@tiptap/core";
export {
  search as visualSearch,
  SearchQuery,
  setSearchState,
  findNext,
  findPrev,
  replaceCurrent,
  replaceAll,
} from "prosemirror-search";
export { GFM } from "@lezer/markdown";
export { Decoration, ViewPlugin } from "@codemirror/view";
export { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
export { tags } from "@lezer/highlight";
