"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { confirmAlert } from "@/app/utils/alert";

/**
 * Warns before unsaved work is lost: browser reload/close (beforeunload),
 * in-app link clicks (sidebar, breadcrumbs) and the browser Back button.
 * The App Router has no route-change event, so internal links are intercepted
 * in the capture phase while `dirty` is true.
 */
export default function useUnsavedChangesGuard(dirty: boolean, message = "You have unsaved changes that will be lost.") {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  // True while a duplicate ("sentinel") history entry sits above the real one.
  const sentinelRef = useRef(false);

  useEffect(() => {
    if (dirty && !sentinelRef.current) {
      window.history.pushState({ unsavedGuard: true }, "", window.location.href);
      sentinelRef.current = true;
    }
  }, [dirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      confirmAlert(message, "Leave without saving", () => {
        dirtyRef.current = false;
        router.push(url.pathname + url.search + url.hash);
      });
    };

    // Browser Back pops the sentinel entry: confirm (dirty) or skip over it (saved).
    const onPopState = () => {
      if (!sentinelRef.current) return;
      if (dirtyRef.current) {
        window.history.pushState({ unsavedGuard: true }, "", window.location.href);
        confirmAlert(message, "Leave without saving", () => {
          dirtyRef.current = false;
          sentinelRef.current = false;
          window.history.go(-2);
        });
      } else {
        sentinelRef.current = false;
        window.history.back();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [message, router]);
}
