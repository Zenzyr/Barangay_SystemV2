import { Extension, type Attribute } from "@tiptap/core";

const TYPES = ["paragraph", "heading"];
export const INDENT_STEP_PT = 36;
export const MAX_INDENT_PT = 360;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphLayout: {
      setLineSpacing: (multiple: number | null) => ReturnType;
      indentParagraph: (deltaPt: number) => ReturnType;
    };
  }
}

const cssAttr = (name: string, cssProp: string): Attribute => ({
  default: null,
  parseHTML: (el) => el.style.getPropertyValue(cssProp) || null,
  renderHTML: (attrs) =>
    attrs[name] ? { style: `${cssProp}: ${attrs[name]}` } : {},
});

export const ParagraphLayout = Extension.create({
  name: "paragraphLayout",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          textIndent: cssAttr("textIndent", "text-indent"),
          marginLeft: cssAttr("marginLeft", "margin-left"),
          spaceBefore: cssAttr("spaceBefore", "margin-top"),
          spaceAfter: cssAttr("spaceAfter", "margin-bottom"),
          lineHeight: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-line-height"),
            renderHTML: (attrs) =>
              attrs.lineHeight
                ? {
                    "data-line-height": attrs.lineHeight,
                    style: `line-height: calc(${attrs.lineHeight} * 1.2)`,
                  }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineSpacing:
        (multiple) =>
        ({ chain }) =>
          chain()
            .updateAttributes("paragraph", {
              lineHeight: multiple ? String(multiple) : null,
            })
            .updateAttributes("heading", {
              lineHeight: multiple ? String(multiple) : null,
            })
            .run(),

      indentParagraph:
        (deltaPt) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!TYPES.includes(node.type.name)) return;
            const current = parseFloat(node.attrs.marginLeft) || 0;
            const next = Math.min(
              MAX_INDENT_PT,
              Math.max(0, current + deltaPt),
            );
            if (next !== current) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                marginLeft: next ? `${next}pt` : null,
              });
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});
