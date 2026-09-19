import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export interface PageBreakOptions {
  getMetrics: () => { pageHeight: number; topMargin: number };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

const key = new PluginKey("pageBreakLayout");

function layoutBreaks(view: EditorView, opts: PageBreakOptions) {
  const { pageHeight, topMargin } = opts.getMetrics();
  if (!pageHeight) return;
  const breaks = view.dom.querySelectorAll<HTMLElement>(".page-break");
  breaks.forEach((el) => {
    el.style.height = "0px";
    const top = el.offsetTop + topMargin;
    const nextPageTop = (Math.floor(top / pageHeight) + 1) * pageHeight;
    let height = nextPageTop + topMargin - top;
    if (height < 28) height += pageHeight;
    el.style.height = `${height}px`;
  });
}

export const PageBreak = Node.create<PageBreakOptions>({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { getMetrics: () => ({ pageHeight: 0, topMargin: 0 }) };
  },

  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "",
        class: "page-break",
      }),
      ["span", { class: "page-break__label" }, "Page break"],
    ];
  },

  renderText() {
    return "\n\f\n";
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },

  addKeyboardShortcuts() {
    return { "Mod-Enter": () => this.editor.commands.insertPageBreak() };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin({
        key,
        view(view) {
          let frame = 0;
          const run = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(
              () => view.dom.isConnected && layoutBreaks(view, opts),
            );
          };
          const observer =
            typeof ResizeObserver !== "undefined"
              ? new ResizeObserver(run)
              : null;
          observer?.observe(view.dom);
          run();
          return {
            update: run,
            destroy: () => (
              cancelAnimationFrame(frame),
              observer?.disconnect()
            ),
          };
        },
      }),
    ];
  },
});
