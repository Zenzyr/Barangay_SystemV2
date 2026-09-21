import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function BackButton({ className, href }: { className?: string; href?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-2 mb-4 -ml-2 ${className}`}
      onClick={() => (href ? router.push(href) : router.back())}
    >
      <ArrowLeft className="size-4" />
      Back
    </Button>
  );
}
