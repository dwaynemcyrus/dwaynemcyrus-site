import { visit } from "unist-util-visit";
import type { Root } from "mdast";

type Options = {
  index: Map<string, string>;
};

export function remarkWikiLinks(options: Options) {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const value = node.value;
      const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

      if (!wikiLinkRegex.test(value)) {
        return;
      }

      wikiLinkRegex.lastIndex = 0;
      const newChildren = [];
      let lastIndex = 0;
      let match;

      while ((match = wikiLinkRegex.exec(value)) !== null) {
        const [full, target, display] = match;
        const resolved = options.index.get(target.toLowerCase().trim());

        if (match.index > lastIndex) {
          newChildren.push({
            type: "text",
            value: value.slice(lastIndex, match.index),
          });
        }

        if (resolved) {
          newChildren.push({
            type: "link",
            url: resolved,
            children: [{ type: "text", value: display || target }],
            data: {
              hProperties: {
                className: ["wiki-link"],
              },
            },
          });
        } else {
          newChildren.push({
            type: "html",
            value: `<span class="wiki-link-broken" title="Page not found">${
              display || target
            }</span>`,
          });
        }

        lastIndex = match.index + full.length;
      }

      if (lastIndex < value.length) {
        newChildren.push({
          type: "text",
          value: value.slice(lastIndex),
        });
      }

      if (newChildren.length > 0) {
        parent.children.splice(index, 1, ...newChildren);
        return index + newChildren.length;
      }
    });
  };
}
