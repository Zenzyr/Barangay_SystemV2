"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";



export function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  active,
  disabled,
  children,
  className = "",
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 ${
        active ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : ""
      } ${className}`}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full flex-wrap items-center gap-0.5 border-r border-slate-200 pr-2 last:border-r-0">
      {children}
    </div>
  );
}

/**
 * Popover panel anchored to a trigger. Rendered in a portal with fixed
 * positioning so the ribbon's overflow never clips it.
 */
export function Dropdown({
  label,
  trigger,
  children,
  width = 256,
  active,
  disabled,
  openSignal,
  onOpenChange,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  width?: number;
  active?: boolean;
  disabled?: boolean;
  /** Changing this number opens the panel (used for keyboard shortcuts). */
  openSignal?: number;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const w = Math.min(width, window.innerWidth - 16);
    setPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)) });
  }, [width]);

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Only react to signals raised after mount (a remount must not re-open the panel).
  const handledSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === handledSignal.current) return;
    handledSignal.current = openSignal;
    place();
    setOpenState(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpenState(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenState(false);
    const onResize = () => setOpenState(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, setOpenState]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpenState(!open)}
        className={`inline-flex h-8 items-center justify-center gap-0.5 rounded-md px-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 ${
          active || open ? "bg-blue-100 text-blue-800" : ""
        }`}
      >
        {trigger}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              style={{ top: pos.top, left: pos.left, width: Math.min(width, window.innerWidth - 16) }}
              className="fixed z-[100] max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-xl"
            >
              {children(() => setOpenState(false))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
