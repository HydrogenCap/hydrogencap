/**
 * Hand-rolled axe HTML report generator (~50 lines).
 * Avoids the `axe-html-reporter` dep weight question entirely.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AxeResults, Result, NodeResult } from 'axe-core';

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function renderNode(n: NodeResult): string {
  const targets = (n.target ?? []).map((t) => esc(String(t))).join(' &gt; ');
  return `<li><code>${targets}</code><br/><small>${esc(n.failureSummary ?? '')}</small></li>`;
}

function renderViolation(v: Result): string {
  return `<details open><summary><strong>[${esc(v.impact ?? 'n/a')}]</strong> <code>${esc(v.id)}</code> — ${esc(v.help)} <a href="${esc(v.helpUrl)}" target="_blank" rel="noopener">docs</a> (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})</summary><p>${esc(v.description)}</p><ul>${v.nodes.map(renderNode).join('')}</ul></details>`;
}

export function writeAxeHtmlReport(filePath: string, route: string, mode: string, results: AxeResults): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const groups: Record<string, Result[]> = { critical: [], serious: [], moderate: [], minor: [] };
  for (const v of results.violations) {
    (groups[v.impact ?? 'minor'] ?? groups.minor).push(v);
  }
  const sections = (['critical', 'serious', 'moderate', 'minor'] as const)
    .map(
      (k) =>
        `<section><h2>${k} (${groups[k].length})</h2>${groups[k].length ? groups[k].map(renderViolation).join('') : '<p><em>None</em></p>'}</section>`,
    )
    .join('');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>axe report — ${esc(route)} ${esc(mode)}</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#0f172a}h1{margin-bottom:.25rem}h2{border-bottom:1px solid #e2e8f0;padding-bottom:.25rem;margin-top:2rem}code{background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:.9em}details{margin:.5rem 0;padding:.5rem .75rem;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:3px}summary{cursor:pointer}small{color:#64748b}</style></head><body><h1>axe-core a11y report</h1><p><strong>Route:</strong> ${esc(route)} &nbsp;|&nbsp; <strong>Mode:</strong> ${esc(mode)} &nbsp;|&nbsp; <strong>URL:</strong> ${esc(results.url ?? '')} &nbsp;|&nbsp; <strong>Time:</strong> ${esc(results.timestamp ?? '')}</p><p>Total violations: <strong>${results.violations.length}</strong> &nbsp;|&nbsp; Passes: ${results.passes.length} &nbsp;|&nbsp; Incomplete: ${results.incomplete.length}</p>${sections}</body></html>`;
  writeFileSync(filePath, html, 'utf8');
}
