import fs from "node:fs";
import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";

async function main() {
  const src = process.argv[2];
  const bytes = fs.readFileSync(src);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const page = doc.getPage(0);
  const res = page.node.Resources();
  const fonts = res.lookup(PDFName.of("Font"));
  if (fonts) {
    for (const [key, ref] of Object.entries(fonts.dict.entries)) {
      try {
        const f = doc.context.lookup(ref);
        const bf = f.get(PDFName.of("BaseFont"));
        const sub = f.get(PDFName.of("Subtype"));
        console.log(String(key), "Subtype:", String(sub), "BaseFont:", String(bf));
      } catch (e) {
        console.log(String(key), "err", String(e));
      }
    }
  } else {
    // maybe resources are inherited
    const parents = [];
    let p = page.node;
    for (let i = 0; i < 10; i++) {
      parents.push(p);
      const Par = p.get(PDFName.of("Parent"));
      if (!Par) break;
      p = doc.context.lookup(Par);
    }
    console.log("page has no own resources, parent chain", parents.length);
  }
}
main();