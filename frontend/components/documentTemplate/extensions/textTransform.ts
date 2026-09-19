import { Extension } from "@tiptap/core";

export const TextTransform = Extension.create({
  name: "textTransform",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          textTransform: {
            default: null,
            parseHTML: (el) =>
              el.style.textTransform === "uppercase" ? "uppercase" : null,
            renderHTML: (attrs) =>
              attrs.textTransform ? { style: "text-transform: uppercase" } : {},
          },
        },
      },
    ];
  },
});
