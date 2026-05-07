import type { AwaaabComplaint, DecentHomesItem } from './types';
import { DECENT_HOMES_TEMPLATE } from './templates';

export const STORAGE_KEY_AWAAB = 'rrb_awaab_complaints';
export const STORAGE_KEY_DECENT = 'rrb_decent_homes';

export function loadAwaaab(): AwaaabComplaint[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_AWAAB) || '[]'); }
  catch (err) { console.error('Failed to load Awaab complaints from storage:', err); return []; }
}

export function saveAwaaab(items: AwaaabComplaint[]) {
  localStorage.setItem(STORAGE_KEY_AWAAB, JSON.stringify(items));
}

export function loadDecent(): DecentHomesItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_DECENT) || '{}') as Record<string, { confirmed: boolean; confirmed_date?: string }>;
    return DECENT_HOMES_TEMPLATE.map(t => ({
      ...t,
      confirmed: stored[t.key]?.confirmed ?? false,
      confirmed_date: stored[t.key]?.confirmed_date,
    }));
  } catch (err) {
    console.error('Failed to load Decent Homes data from storage:', err);
    return DECENT_HOMES_TEMPLATE.map(t => ({ ...t, confirmed: false }));
  }
}

export function saveDecent(items: DecentHomesItem[]) {
  const out: Record<string, { confirmed: boolean; confirmed_date?: string }> = {};
  for (const item of items) {
    out[item.key] = { confirmed: item.confirmed, confirmed_date: item.confirmed_date };
  }
  localStorage.setItem(STORAGE_KEY_DECENT, JSON.stringify(out));
}
