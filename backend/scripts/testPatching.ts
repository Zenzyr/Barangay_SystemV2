
import { patchDocument, PatchType, TextRun } from "docx";
import * as fs from "fs";
import * as path from "path";

async function testPatching() {
  const filePath = path.resolve(__dirname, "../../frontend/docs/certification-101.docx");
  if (!fs.existsSync(filePath)) {
      console.log("File not found:", filePath);
      return;
  }
  const buffer = fs.readFileSync(filePath);
  console.log("Original size:", buffer.length);
  
  const patched = await patchDocument({
    outputType: "blob" as any,
    data: buffer,
    patches: {
      fullName: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun("TEST NAME")],
      },
      civilStatus: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun("Single")],
      },
    },
  });
  
  // Convert blob to buffer if necessary
  const arrayBuffer = await (patched as any).arrayBuffer();
  fs.writeFileSync("test-patched.docx", Buffer.from(arrayBuffer));
  console.log("Patched size:", arrayBuffer.byteLength);
}

testPatching().catch(console.error);
