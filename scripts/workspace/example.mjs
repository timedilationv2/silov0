// Bundled prose, deliberately separate from the published sample metadata.
// Only an explicit UI action copies this into the existing document store.
export const exampleDocument = {
  title: "Documentation release checklist",
  content: `# Documentation release checklist

## Purpose
Check a documentation change before it is published. This example describes a small static documentation site; adapt the checks to your own project.

## Before you begin
- Open the proposed source change and its rendered preview.
- Identify the page owner and the release being documented.
- Keep a copy of the last published version for recovery.

## Check the change
1. Follow the instructions from a clean local checkout.
2. Compare commands, parameters, and expected results with the implementation.
3. Open every changed internal link and check its heading target.
4. Read the page at a narrow screen width and navigate its controls with the keyboard.
5. Ask the page owner to review the result before merging.

## Verify publication
Open the published page after deployment. Confirm the revised heading and repeat the main task. A merged change alone does not prove deployment succeeded.

## If verification fails
Record the failing URL and observed result without credentials or personal data. Revert the source change through the normal review process if the published instructions could cause harm, then verify the restored page.
`,
};
