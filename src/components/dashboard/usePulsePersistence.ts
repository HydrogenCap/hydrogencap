import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';

const HISTORY_KEY = 'pulse.score.history.v1';
const SNOOZE_KEY = 'pulse.snoozed.v1';
const MAX_DAYS = 14;

interface HistoryEntry {
  date: string; // yyyy-MM-dd
  score: number;
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_DAYS) : [];
  } catch {
    return [];
  }
}

function writeHistory(h: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_DAYS)));
  } catch {
    /* ignore */
  }
}

export function usePulseHistory(currentScore: number) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = readHistory();
    const idx = existing.findIndex((e) => e.date === today);
    let next: HistoryEntry[];
    if (idx === -1) {
      next = [...existing, { date: today, score: currentScore }];
    } else {
      next = [...existing];
      next[idx] = { date: today, score: currentScore };
    }
    writeHistory(next);
    setHistory(next);
  }, [currentScore]);

  const prev = history.length >= 2 ? history[history.length - 2].score : null;
  const delta = prev !== null ? currentScore - prev : null;

  return { history, delta };
}

interface SnoozeMap {
  [actionId: string]: string; // yyyy-MM-dd until which snoozed
}

function readSnoozed(): SnoozeMap {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeSnoozed(s: SnoozeMap) {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function usePulseSnooze() {
  const [snoozed, setSnoozed] = useState<SnoozeMap>(() => readSnoozed());
  const today = format(new Date(), 'yyyy-MM-dd');

  const isSnoozed = useCallback(
    (id: string) => {
      const until = snoozed[id];
      return !!until && until >= today;
    },
    [snoozed, today],
  );

  const snoozeUntilTomorrow = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const until = format(tomorrow, 'yyyy-MM-dd');
    const next = { ...readSnoozed(), [id]: until };
    writeSnoozed(next);
    setSnoozed(next);
  }, []);

  const unsnooze = useCallback((id: string) => {
    const next = { ...readSnoozed() };
    delete next[id];
    writeSnoozed(next);
    setSnoozed(next);
  }, []);

  return { isSnoozed, snoozeUntilTomorrow, unsnooze, snoozed };
}
