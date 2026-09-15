import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
  config: Record<string, { label: string; dot?: string; text: string; bg: string }>;
}

export function StatusBadge({ status, className, config }: StatusBadgeProps) {
  const cfg = config[status] || { label: status, text: "text-gray-700", bg: "bg-gray-50" };

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", cfg.bg, cfg.text, className)}>
      {cfg.dot && <span className={cn("size-1.5 rounded-full", cfg.dot)} />}
      {cfg.label}
    </span>
  );
}
