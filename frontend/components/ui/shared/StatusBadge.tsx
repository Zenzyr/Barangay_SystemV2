import { cn } from "@/lib/utils";
import { type StatusConfig } from "@/lib/constants/status";
import { LucideIcon } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
  config: Record<string, StatusConfig>;
}

export function StatusBadge({ status, className, config }: StatusBadgeProps) {
  const cfg = config[status] || { 
    label: status, 
    text: "text-gray-700", 
    bg: "bg-gray-50",
    border: "border-gray-200"
  };

  const Icon = cfg.icon as LucideIcon;

  return (
    <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", 
        cfg.bg, 
        cfg.text, 
        cfg.border || "border-transparent",
        className
    )}>
      {Icon && <Icon className={cn("size-3", status === "processing" ? "animate-spin" : "")} />}
      {cfg.label}
    </span>
  );
}

