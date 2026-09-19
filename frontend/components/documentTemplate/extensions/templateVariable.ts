import { InputRule, mergeAttributes, Node } from "@tiptap/core";
import { humanizeVariable } from "../lib/pageMetrics";

export interface TemplateVariableOptions {
  isKnown: (key: string) => boolean;
  asText: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateVariable: {
      insertTemplateVariable: (key: string) => ReturnType;
    };
  }
}

export const TemplateVariable = Node.create<TemplateVariableOptions>({
  name: "templateVariable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { isKnown: () => true, asText: false };
  },

  addAttributes() {
    return {
      key: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-template-variable") || "",
        renderHTML: (attrs) => ({ "data-template-variable": attrs.key }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-template-variable]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    if (this.options.asText) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, { class: "template-variable--text" }),
        `{{${node.attrs.key}}}`,
      ];
    }
    const known = this.options.isKnown(node.attrs.key);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: known
          ? "template-variable"
          : "template-variable template-variable--unknown",
        title: `{{${node.attrs.key}}}${known ? "" : " — not a known BIMS variable"}`,
      }),
      humanizeVariable(node.attrs.key),
    ];
  },

  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },

  addCommands() {
    return {
      insertTemplateVariable:
        (key) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { key } }),
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\{\{([a-z][a-z0-9_]{0,63})\}\}$/,
        handler: ({ state, range, match }) => {
          const key = match[1];
          if (!this.options.isKnown(key)) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create({ key }));
        },
      }),
    ];
  },
});
