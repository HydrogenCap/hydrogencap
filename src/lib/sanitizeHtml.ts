/**
 * Small, dependency-free HTML sanitizer.
 *
 * Uses the browser's DOMParser to parse HTML into a DOM tree, then walks the
 * tree removing any element or attribute that isn't on an allowlist. This is
 * sufficient for the two surfaces we use it on (report previews and tenancy
 * agreement previews) which only need basic formatting tags — never scripts,
 * iframes, form elements, inline event handlers, or URL-based attributes.
 *
 * For untrusted input with complex requirements, prefer DOMPurify. This
 * utility exists to avoid adding a runtime dependency for our limited surfaces.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
  'hr',
]);

// Per-tag attribute allowlist. Everything not listed is stripped.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

// Global class allowlist (e.g. tailwind utility classes). We keep these so
// report/agreement HTML with layout classes still renders correctly.
const GLOBAL_ALLOWED_ATTRS = new Set(['class']);

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;
  // Allow relative URLs, https, http, mailto, tel — reject javascript:, data:, vbscript: etc.
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('vbscript:')) return false;
  return true;
}

function walk(node: Element): void {
  // Copy children to an array first; we mutate during iteration.
  const children = Array.from(node.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Remove the element and all its descendants.
      child.remove();
      continue;
    }

    // Strip disallowed attributes.
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const allowedForTag = ALLOWED_ATTRS[tag];
      const ok = GLOBAL_ALLOWED_ATTRS.has(name) || (allowedForTag?.has(name) ?? false);
      if (!ok) {
        child.removeAttribute(attr.name);
        continue;
      }
      if (name === 'href' && !isSafeUrl(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }

    // Force links to be safe externally.
    if (tag === 'a' && child.hasAttribute('href')) {
      child.setAttribute('rel', 'noopener noreferrer nofollow');
      if (!child.hasAttribute('target')) child.setAttribute('target', '_blank');
    }

    walk(child);
  }
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  // SSR / tests without a DOM — fall back to escaping.
  if (typeof document === 'undefined') {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__sanitize_root__">${input}</div>`, 'text/html');
  const root = doc.getElementById('__sanitize_root__');
  if (!root) return '';
  walk(root);
  return root.innerHTML;
}
