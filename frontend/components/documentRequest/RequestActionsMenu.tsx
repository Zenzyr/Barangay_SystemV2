"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RequestActionItem {
  key: string;
  label: string;
  icon: React.ElementType;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface Props {
  actions: RequestActionItem[];
  align?: "left" | "right";
  disabled?: boolean;
}

/**
 * Lightweight kebab (⋮) dropdown menu. The project has no dropdown-menu
 * primitive yet, so this builds one from a button + popover with click-outside
 * and Escape handling.
 */
export default function RequestActionsMenu({ actions, align = "right", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX
        });
    }

    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = (
        <div
          className={cn(
            "fixed z-[100] mt-1 w-48 min-w-[10rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg p-1",
            align === "right" ? "right-4" : "left-4"
          )}
          style={{ top: position.top + 30, left: align === "right" ? undefined : position.left, right: align === "right" ? window.innerWidth - position.left - 30 : undefined }}
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40",
                  action.className
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {action.label}
              </button>
            );
          })}
        </div>
  );

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="h-7 w-7 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
      >
        <MoreVertical className="size-4" />
      </Button>

      {open && createPortal(menu, document.body)}
    </div>
  );
}