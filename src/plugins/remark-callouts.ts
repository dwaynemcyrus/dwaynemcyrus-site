import { visit } from "unist-util-visit";
import type { Root } from "mdast";

const CALLOUT_TYPES = new Set([
  "note",
  "tip",
  "warning",
  "danger",
  "quote",
  "example",
]);

export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, "blockquote", (node) => {
      const firstChild = node.children?.[0];
      if (!firstChild || firstChild.type !== "paragraph") {
        return;
      }

      const firstText = firstChild.children?.[0];
      if (!firstText || firstText.type !== "text") {
        return;
      }

      const match = firstText.value.match(/^\[!(\w+)\](?:\s+(.+))?/);
      if (!match) {
        return;
      }

      const [, rawType, customTitle] = match;
      const type = rawType.toLowerCase();
      if (!CALLOUT_TYPES.has(type)) {
        return;
      }

      firstText.value = firstText.value.replace(
        /^\[!\w+\](?:\s+.+)?\s*/,
        "",
      );

      if (!firstText.value) {
        firstChild.children.shift();
      }

      node.data = {
        hName: "div",
        hProperties: {
          className: ["callout", `callout-${type}`],
          "data-callout-type": type,
          "data-callout-title": customTitle || type,
        },
      };
    });
  };
}
