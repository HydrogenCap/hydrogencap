/**
 * Auto-matching logic for bank transaction reconciliation.
 */

import type { BankTransaction } from '@/hooks/useBankTransactions';
import { SEVERITY } from '@/lib/design-tokens';
import type { RentScheduleWithDetails } from '@/hooks/useRentCollection';

export interface ReconciliationMatch {
  transaction: BankTransaction;
  scheduleItem: RentScheduleWithDetails;
  confidence: number;
  reason: string;
}

export function findMatches(
  transactions: BankTransaction[],
  scheduleItems: RentScheduleWithDetails[]
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];
  const usedTxns = new Set<string>();
  const usedSchedule = new Set<string>();

  // Only look at outstanding schedule items
  const outstanding = scheduleItems.filter(
    s => s.status !== 'paid' && s.status !== 'bad_debt' && s.amount_outstanding > 0
  );

  // Pass 1: Exact amount + tenant name in reference (0.95)
  for (const txn of transactions) {
    if (usedTxns.has(txn.id)) continue;
    const searchText = `${txn.description} ${txn.reference || ''}`.toLowerCase();

    for (const item of outstanding) {
      if (usedSchedule.has(item.id)) continue;

      const amountMatch = Math.abs(txn.amount - item.amount_outstanding) < 0.01;
      if (!amountMatch) continue;

      const lastName = item.tenancy.tenant.last_name.toLowerCase();
      const firstName = item.tenancy.tenant.first_name.toLowerCase();
      const nameMatch = searchText.includes(lastName) || searchText.includes(firstName);

      if (nameMatch) {
        matches.push({
          transaction: txn,
          scheduleItem: item,
          confidence: 0.95,
          reason: `Exact amount (£${txn.amount.toFixed(2)}) + tenant name "${item.tenancy.tenant.last_name}" found in reference`,
        });
        usedTxns.add(txn.id);
        usedSchedule.add(item.id);
        break;
      }
    }
  }

  // Pass 2: Exact amount + property reference (0.85)
  for (const txn of transactions) {
    if (usedTxns.has(txn.id)) continue;
    const searchText = `${txn.description} ${txn.reference || ''}`.toLowerCase();

    for (const item of outstanding) {
      if (usedSchedule.has(item.id)) continue;

      const amountMatch = Math.abs(txn.amount - item.amount_outstanding) < 0.01;
      if (!amountMatch) continue;

      const address = item.tenancy.property.address_line.toLowerCase();
      const addressParts = address.split(/[\s,]+/).filter(p => p.length > 3);
      const addressMatch = addressParts.some(part => searchText.includes(part));
      const roomMatch = searchText.includes(item.tenancy.room.room_name.toLowerCase());

      if (addressMatch || roomMatch) {
        matches.push({
          transaction: txn,
          scheduleItem: item,
          confidence: 0.85,
          reason: `Exact amount + property reference found`,
        });
        usedTxns.add(txn.id);
        usedSchedule.add(item.id);
        break;
      }
    }
  }

  // Pass 3: Exact amount only (0.60)
  for (const txn of transactions) {
    if (usedTxns.has(txn.id)) continue;

    for (const item of outstanding) {
      if (usedSchedule.has(item.id)) continue;

      const amountMatch = Math.abs(txn.amount - item.amount_outstanding) < 0.01;
      if (amountMatch) {
        matches.push({
          transaction: txn,
          scheduleItem: item,
          confidence: 0.60,
          reason: `Exact amount match (£${txn.amount.toFixed(2)})`,
        });
        usedTxns.add(txn.id);
        usedSchedule.add(item.id);
        break;
      }
    }
  }

  // Pass 4: Close amount within £5 (0.40)
  for (const txn of transactions) {
    if (usedTxns.has(txn.id)) continue;

    for (const item of outstanding) {
      if (usedSchedule.has(item.id)) continue;

      const diff = Math.abs(txn.amount - item.amount_outstanding);
      if (diff > 0.01 && diff <= 5) {
        matches.push({
          transaction: txn,
          scheduleItem: item,
          confidence: 0.40,
          reason: `Close amount (£${diff.toFixed(2)} difference)`,
        });
        usedTxns.add(txn.id);
        usedSchedule.add(item.id);
        break;
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

export function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.85) return { label: 'High Match', color: SEVERITY.success.badge };
  if (confidence >= 0.60) return { label: 'Possible Match', color: SEVERITY.warning.badge };
  return { label: 'Low Confidence', color: SEVERITY.critical.badge };
}
