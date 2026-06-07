/**
 * Escape a string for safe interpolation into HTML.
 * Prevents HTML/script injection when user- or DB-sourced values are
 * dropped into email templates or other HTML output.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape then convert newlines to <br> for plain-text style messages. */
export function escapeHtmlMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}
