/**
 * Validate an image URL for the branding/settings fields (logo, seal,
 * background). Only app-relative paths and http(s) URLs are accepted; anything
 * else (empty is allowed => "not configured") is rejected so that junk like
 * pasted BBCode never reaches the render pipeline and silently breaks parity
 * with the accepted templates.
 */
export function sanitizeImageUrl(raw?: string): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^https?:\/\/\S+$/i.test(value) || /^\/\S+$/.test(value)) return value;
  return undefined;
}

export function isValidImageUrl(raw?: string): boolean {
  if (!raw || !raw.trim()) return true;
  return /^https?:\/\/\S+$/i.test(raw.trim()) || /^\/\S+$/.test(raw.trim());
}