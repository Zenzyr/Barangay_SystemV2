import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-2 mb-4 -ml-2 ${className}`}
      onClick={() => router.back()}
    >
      <ArrowLeft className="size-4" />
      Back
    </Button>
  );
}
