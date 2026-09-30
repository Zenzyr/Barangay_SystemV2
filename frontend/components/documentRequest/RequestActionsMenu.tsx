"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
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

export default function RequestActionsMenu({ actions, align = "right", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const handleResize = () => {
      const isMobileQuery = window.matchMedia("(max-width: 1024px)");
      setIsMobile(isMobileQuery.matches);
    };
    handleResize();
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    mediaQuery.addEventListener("change", handleResize);
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    if (!open) return;

    if (!isMobile && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }

    const onPointerUp = (e: PointerEvent) => {
      // If clicking inside the content that is NOT the mobile backdrop, don't close.
      const portalContent = document.getElementById('portal-content-inner');
      if (portalContent && portalContent.contains(e.target as Node)) {
        return;
      }
      
      // If clicking the container button, let the handler manage it
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  const getPortalRoot = () => {
    let portalRoot = document.getElementById("portal-root");
    if (!portalRoot) {
      portalRoot = document.createElement("div");
      portalRoot.setAttribute("id", "portal-root");
      document.body.appendChild(portalRoot);
    }
    return portalRoot;
  };

  const menuContent = open && (
    <div className={cn(
      isMobile ? "fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60" : "absolute z-[1000] mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl p-1"
    )}
    style={!isMobile ? {
      top: position.top + 44,
      left: align === "right" ? undefined : position.left,
      right: align === "right" ? window.innerWidth - (position.left + 44) : undefined,
    } : {}}>
      <div id="portal-content-inner" className={cn("bg-white p-1 rounded-xl shadow-xl w-full", isMobile ? "max-w-sm" : "w-48")}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              disabled={action.disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40",
                action.className
              )}
            >
              <Icon className="size-5 shrink-0" />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="More actions"
        className="h-11 w-11 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      >
        <MoreVertical className="size-5" />
      </Button>

      {open && typeof document !== "undefined" && createPortal(menuContent, getPortalRoot())}
    </div>
  );
}
