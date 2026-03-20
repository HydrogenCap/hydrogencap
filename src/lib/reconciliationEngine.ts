/**
 * Reconciliation matching engine — pure functions, no side effects, fully testable.
 * Scores bank transactions against rent schedule items using a 0–100 confidence scale.
 */

import type { RentScheduleItem } from '@/hooks/useRentCollection';

export interface BankTxn {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  reference: string | null;
  status: string;
}

export interface MatchCandidate {
  transactionId: string;
  scheduleId: string;
  confidence: number;         // 0–100
  matchReasons: string[];
  transactionAmount: number;
  expectedAmount: number;
  amountDifference: number;
}

// ─── Matching Logic ──────────────────────────────────────────────────

/**
 * Score a single bank transaction against a single rent schedule item.
 * Returns null if no plausible match, or a MatchCandidate with confidence 0–100.
 */
export function scoreMatch(
  txn: BankTxn,
  schedule: RentScheduleItem & {
    tenant_name?: string;
    payment_reference?: string | null;
  }
): MatchCandidate | null {
  if (txn.amount <= 0) return null;
  if (txn.status !== 'unmatched') return null;

  let score = 0;
  const reasons: string[] = [];

  // ─── Amount matching (max 40 points) ───
  const expected = schedule.rent_amount + (schedule.additional_charges || 0);
  const outstanding = schedule.amount_outstanding || expected;
  const diff = Math.abs(txn.amount - outstanding);
  const diffPct = outstanding > 0 ? (diff / outstanding) * 100 : 100;

  if (diff === 0) {
    score += 40;
    reasons.push('exact_amount');
  } else if (diff < 1) {
    score += 38;
    reasons.push('amount_within_1p');
  } else if (diffPct <= 5) {
    score += 25;
    reasons.push('amount_within_5pct');
  } else if (txn.amount > outstanding * 0.5 && txn.amount < outstanding * 1.5) {
    score += 10;
    reasons.push('partial_amount');
  } else {
    return null;
  }

  // ─── Date matching (max 25 points) ───
  const txnDate = new Date(txn.transaction_date);
  const dueDate = new Date(schedule.due_date);
  const daysDiff = Math.abs(
    Math.floor((txnDate.getTime() - dueDate.getTime()) / 86400000)
  );

  if (daysDiff === 0) {
    score += 25;
    reasons.push('exact_date');
  } else if (daysDiff <= 3) {
    score += 20;
    reasons.push('date_within_3_days');
  } else if (daysDiff <= 7) {
    score += 12;
    reasons.push('date_within_7_days');
  } else if (daysDiff <= 14) {
    score += 5;
    reasons.push('date_within_14_days');
  } else if (daysDiff <= 31) {
    score += 2;
    reasons.push('date_within_month');
  }

  // ─── Reference matching (max 20 points) ───
  const txnRef = (txn.reference || txn.description).toLowerCase();
  const payRef = (schedule.payment_reference || '').toLowerCase();

  if (payRef && txnRef.includes(payRef)) {
    score += 20;
    reasons.push('reference_match');
  } else if (payRef) {
    const shortRef = payRef.slice(-6);
    if (shortRef.length >= 4 && txnRef.includes(shortRef)) {
      score += 10;
      reasons.push('partial_reference');
    }
  }

  // ─── Tenant name in description (max 15 points) ───
  if (schedule.tenant_name) {
    const desc = txn.description.toLowerCase();
    const nameParts = schedule.tenant_name.toLowerCase().split(/\s+/);

    if (desc.includes(schedule.tenant_name.toLowerCase())) {
      score += 15;
      reasons.push('full_name_in_desc');
    } else if (nameParts.length > 1 && desc.includes(nameParts[nameParts.length - 1])) {
      score += 8;
      reasons.push('surname_in_desc');
    }
  }

  // Minimum confidence threshold (raised from 30 to 40)
  if (score < 40) return null;

  // Below 60: require at least one non-amount signal to avoid false positives in HMO portfolios
  const nonAmountReasons = ['reference_match', 'partial_reference', 'full_name_in_desc', 'surname_in_desc'];
  if (score < 60 && !reasons.some(r => nonAmountReasons.includes(r))) {
    return null;
  }

  return {
    transactionId: txn.id,
    scheduleId: schedule.id,
    confidence: Math.min(score, 100),
    matchReasons: reasons,
    transactionAmount: txn.amount,
    expectedAmount: outstanding,
    amountDifference: txn.amount - outstanding,
  };
}

/**
 * Run the matching engine across all unmatched transactions and unreconciled schedule items.
 * Returns the best match per transaction (highest confidence), sorted by confidence desc.
 */
export function findMatches(
  transactions: BankTxn[],
  scheduleItems: (RentScheduleItem & {
    tenant_name?: string;
    payment_reference?: string | null;
  })[]
): MatchCandidate[] {
  const openItems = scheduleItems.filter(s =>
    ['due', 'overdue', 'partial', 'upcoming'].includes(s.status)
  );

  const allCandidates: MatchCandidate[] = [];

  for (const txn of transactions) {
    if (txn.status !== 'unmatched') continue;
    if (txn.amount <= 0) continue;

    for (const item of openItems) {
      const match = scoreMatch(txn, item);
      if (match) allCandidates.push(match);
    }
  }

  allCandidates.sort((a, b) => b.confidence - a.confidence);

  // Greedy assignment: each transaction and schedule item matched at most once
  const usedTxns = new Set<string>();
  const usedSchedules = new Set<string>();
  const finalMatches: MatchCandidate[] = [];

  for (const candidate of allCandidates) {
    if (usedTxns.has(candidate.transactionId)) continue;
    if (usedSchedules.has(candidate.scheduleId)) continue;

    finalMatches.push(candidate);
    usedTxns.add(candidate.transactionId);
    usedSchedules.add(candidate.scheduleId);
  }

  return finalMatches;
}

// ─── Confidence display helpers ──────────────────────────────────────

export function confidenceLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

export function confidenceColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

export function confidenceBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
  if (score >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
}
