/**
 * Tenant Payment Scoring
 *
 * Calculates a 0-100% payment reliability score and maps it to a rating.
 */

export interface PaymentScoreInputs {
  on_time_payments: number;
  late_payments: number;
  missed_payments: number;
}

export interface PaymentScoreResult {
  score: number; // 0-100
  rating: PaymentScoreRating;
  severity: 'success' | 'info' | 'warning' | 'destructive';
  totalPayments: number;
}

export type PaymentScoreRating = 'Excellent' | 'Good' | 'Fair' | 'Poor';

/**
 * Calculate a weighted payment score (0-100).
 *
 * - On-time payments count as 100%
 * - Late payments count as 40%
 * - Missed payments count as 0%
 *
 * Returns 0 when no payment history exists.
 */
export function calculatePaymentScore(inputs: PaymentScoreInputs): number {
  const { on_time_payments, late_payments, missed_payments } = inputs;
  const total = on_time_payments + late_payments + missed_payments;
  if (total === 0) return 0;

  const weightedSum = on_time_payments * 1.0 + late_payments * 0.4 + missed_payments * 0;
  return Math.round((weightedSum / total) * 100);
}

/**
 * Map a numeric score to a human-readable rating with severity.
 */
export function getPaymentScoreRating(score: number): {
  rating: PaymentScoreRating;
  severity: 'success' | 'info' | 'warning' | 'destructive';
} {
  if (score >= 90) return { rating: 'Excellent', severity: 'success' };
  if (score >= 70) return { rating: 'Good', severity: 'info' };
  if (score >= 50) return { rating: 'Fair', severity: 'warning' };
  return { rating: 'Poor', severity: 'destructive' };
}

/**
 * Convenience: calculate score and rating in one call.
 */
export function getPaymentScoreResult(inputs: PaymentScoreInputs): PaymentScoreResult {
  const score = calculatePaymentScore(inputs);
  const { rating, severity } = getPaymentScoreRating(score);
  const totalPayments = inputs.on_time_payments + inputs.late_payments + inputs.missed_payments;
  return { score, rating, severity, totalPayments };
}
