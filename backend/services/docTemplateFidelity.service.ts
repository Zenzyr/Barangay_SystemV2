import JSZip from "jszip";
import { TEMPLATE_VARIABLE_KEYS } from "../utils/templateVariables";

async function normalizeXml(xml: string): Promise<string> {
  // Merge adjacent <w:t> tags
  // This approach is simplified and assumes simple XML structure
  return xml.replace(/<\/w:t><w:t>/g, "");
}

export async function replaceVariablesInDocx(
  buffer: Buffer,
  values: Record<string, string>
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  
  // XML files to process
  // We can dynamically find files if needed, but for now this covers standard parts
  const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith('.xml') && (f.startsWith('word/document') || f.startsWith('word/header') || f.startsWith('word/footer')));

  for (const file of xmlFiles) {
    if (zip.file(file)) {
      let content = await zip.file(file)!.async("string");
      
      // 1. Normalize (merge adjacent w:t)
      content = await normalizeXml(content);
      
      // 2. Replace placeholders
      for (const key of TEMPLATE_VARIABLE_KEYS) {
        if (values[key] !== undefined) {
             const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
             content = content.replace(regex, escapeXml(values[key] || ""));
        }
      }
      
      zip.file(file, content);
    }
  }

  return await zip.generateAsync({ type: "nodebuffer" });
}

function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
}


