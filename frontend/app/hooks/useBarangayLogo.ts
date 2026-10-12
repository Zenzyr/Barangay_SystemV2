"use client";

import { useEffect, useState } from "react";

const DEFAULT_LOGO = "/assets/logo.jpg";

/**
 * Public branding logo used on the landing / sign-in / sign-up pages. Reads the
 * uploaded Barangay Logo from settings (public endpoint) and falls back to the
 * bundled default until it loads.
 */
export function useBarangayLogo(): string {
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);

  useEffect(() => {
    let active = true;
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL_LIVE}/barangay/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const url = data?.barangay?.logoUrl;
        if (typeof url === "string" && url.trim()) setLogoUrl(url.trim());
      })
      .catch((err) => console.error("Failed to fetch barangay logo:", err));
    return () => {
      active = false;
    };
  }, []);

  return logoUrl;
}
