import StarterKit from "@tiptap/starter-kit";
import {
  TextStyle,
  FontFamily,
  FontSize,
  Color,
} from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
  TableView,
} from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import Typography from "@tiptap/extension-typography";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import type { Extensions } from "@tiptap/react";
import { ParagraphLayout } from "./paragraphLayout";
import { TextTransform } from "./textTransform";
import { TemplateVariable } from "./templateVariable";
import { PageBreak } from "./pageBreak";

export const SAFE_LINK = /^(https?:\/\/|mailto:|tel:)\S+$/i;

class BorderedTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.syncBorders(node);
  }

  update(node: ProseMirrorNode) {
    const accepted = super.update(node);
    if (accepted) this.syncBorders(node);
    return accepted;
  }

  private syncBorders(node: ProseMirrorNode) {
    this.table.setAttribute(
      "data-borders",
      node.attrs.borders === "none" ? "none" : "all",
    );
  }
}

const BorderedTable = Table.extend({
  addNodeView() {
    return ({ node }) => new BorderedTableView(node, this.options.cellMinWidth);
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      borders: {
        default: "all",
        parseHTML: (el) =>
          el.getAttribute("data-borders") === "none" ? "none" : "all",
        renderHTML: (attrs) => ({
          "data-borders": attrs.borders === "none" ? "none" : "all",
        }),
      },
    };
  },
});

export interface BuildExtensionsOptions {
  isKnownVariable: (key: string) => boolean;
  getMetrics: () => { pageHeight: number; topMargin: number };
  readOnly?: boolean;
}

export function buildExtensions({
  isKnownVariable,
  getMetrics,
  readOnly,
}: BuildExtensionsOptions): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
        isAllowedUri: (url) => SAFE_LINK.test(url),
      },
    }),
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    TextTransform,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Subscript,
    Superscript,
    Typography,
    ParagraphLayout,
    Image.configure({ inline: true, allowBase64: true }),
    BorderedTable.configure({
      resizable: !readOnly,
      lastColumnResizable: false,
    }),
    TableRow,
    TableHeader,
    TableCell,
    TemplateVariable.configure({
      isKnown: isKnownVariable,
      asText: !!readOnly,
    }),
    PageBreak.configure({ getMetrics }),
    CharacterCount,
    ...(readOnly
      ? []
      : [
          Placeholder.configure({
            placeholder:
              "Start writing your template… use Insert Variable for {{fields}}.",
          }),
        ]),
  ];
}
