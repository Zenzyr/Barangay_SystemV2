"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getTemplates, updateTemplate } from "@/app/utils/templateService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";


const PLACEHOLDERS = [
  { label: "Full Name", value: "{{resident.fullName}}" },
  { label: "Address", value: "{{resident.address}}" },
  { label: "Birth Date", value: "{{resident.birthDate}}" },
  { label: "Certificate Number", value: "{{certificate.number}}" },
  { label: "Issue Date", value: "{{certificate.date}}" },
];

interface TemplateBlock {
  id: string;
  type: "text" | "image";
  content: string;
}

interface CertificateTemplate {
  _id: string;
  name: string;
  layoutConfig: { backgroundUrl: string; blocks: TemplateBlock[] };
  signatoryConfig: Record<string, { name: string; position: string }>;
}

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: template, isLoading } = useQuery<CertificateTemplate | undefined>({
    queryKey: ["certificate-template", params.id],
    queryFn: () => getTemplates().then((templates: CertificateTemplate[]) => templates.find((t) => t._id === params.id)),
  });

  if (isLoading || !template) return <div>Loading...</div>;

  return (
    <TemplateEditor
      key={template._id}
      template={template}
      onSaved={() => router.push("/pages/admin/certificate-templates")}
    />
  );
}

function TemplateEditor({ template, onSaved }: { template: CertificateTemplate; onSaved: () => void }) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(template.layoutConfig.blocks || []);
  const [signatoryConfig, setSignatoryConfig] = useState<Record<string, { name: string; position: string }>>(
    template.signatoryConfig || {}
  );

  const addBlock = (type: TemplateBlock["type"]) => {
    setBlocks([...blocks, { type, content: "", id: Date.now().toString() }]);
  };

  const updateBlock = (index: number, key: keyof TemplateBlock, value: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [key]: value };
    setBlocks(newBlocks);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === blocks.length - 1)) return;
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    await updateTemplate(template._id, { ...template, layoutConfig: { ...template.layoutConfig, blocks }, signatoryConfig });
    onSaved();
  };

  const insertPlaceholder = (index: number, placeholder: string) => {
    updateBlock(index, 'content', (blocks[index].content || "") + placeholder);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Editor Sidebar */}
      <div className="w-1/3 border-r p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit {template.name}</h2>
        
        <div className="mb-6 space-y-2">
            <Label>Add Content Block</Label>
            <div className="flex gap-2">
                <Button onClick={() => addBlock("text")} variant="outline" size="sm">Text</Button>
                <Button onClick={() => addBlock("image")} variant="outline" size="sm">Image</Button>
            </div>
        <Accordion type="multiple" defaultValue={["signatories"]} className="mb-6 space-y-4">
            <AccordionItem value="signatories" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline font-semibold text-lg">Signatories</AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-4 pt-2">
                        {Object.keys(signatoryConfig).map((key) => (
                            <div key={key} className="space-y-1">
                                <Label className="text-sm font-medium">{signatoryConfig[key].position}</Label>
                                <Input 
                                    value={signatoryConfig[key].name} 
                                    onChange={(e) => setSignatoryConfig({...signatoryConfig, [key]: {...signatoryConfig[key], name: e.target.value}})}
                                    placeholder={`Enter ${signatoryConfig[key].position} name`}
                                    className="h-9"
                                />
                            </div>
                        ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>

        </div>

        <div className="space-y-4">
            {blocks.map((block, index) => (
                <div key={block.id} className="p-4 border rounded-md bg-white shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="font-semibold text-sm">
                            {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block
                        </Label>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => moveBlock(index, 'up')} disabled={index === 0}><ArrowUp className="size-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}><ArrowDown className="size-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => removeBlock(index)} className="text-destructive"><Trash2 className="size-4" /></Button>
                        </div>
                    </div>
                    {block.type === 'text' && (
                        <>
                            <textarea 
                                value={block.content} 
                                onChange={(e) => updateBlock(index, 'content', e.target.value)}
                                className="w-full p-2 border rounded text-sm min-h-[80px]"
                                rows={3}
                            />
                            <Select onValueChange={(val) => insertPlaceholder(index, val)}>
                                <SelectTrigger className="mt-1 h-8 text-sm">
                                    <SelectValue placeholder="Insert Placeholder" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLACEHOLDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </>
                    )}
                </div>
            ))}
        </div>

        <Button onClick={handleSave} className="mt-6 w-full">Save Template</Button>
      </div>

      {/* Preview Pane */}
      <div className="w-2/3 bg-slate-100 p-8 flex justify-center items-start overflow-y-auto">
        <div className="w-[210mm] h-[297mm] bg-white shadow-lg p-10 border border-slate-300">
            {blocks.map((block) => (
                <div key={block.id} className="mb-4">
                    {block.type === 'text' && <div className="whitespace-pre-wrap">{block.content}</div>}
                    {block.type === 'image' && <div className="p-4 border-2 border-dashed text-center">Image Placeholder</div>}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}