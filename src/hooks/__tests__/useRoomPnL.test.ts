/**
 * Tests for the room-level P&L compute engine (Prompt #19).
 *
 * Exercises the pure `computeRoomPnL` function — input is fully
 * controlled so we can assert exact contribution / occupancy values
 * across periods. Network paths in `useRoomPnL` are covered in
 * adjacent integration suites.
 */
import { describe, it, expect } from 'vitest';
import { computeRoomPnL, overlapDays, resolvePeriodRange } from '../useRoomPnL';

const NOW = new Date('2026-04-28T12:00:00Z');

const baseAgreement = {
  id: 'a1', room_id: 'room-1', rent_amount_pcm: 600,
  start_date: '2025-06-01',
};

describe('computeRoomPnL', () => {
  it('happy path: positive contribution from rent minus voids and maintenance', () => {
    const result = computeRoomPnL({
      roomId: 'room-1',
      period: 'last_12_months',
      now: NOW,
      rentPayments: [
        { amount: 600, payment_date: '2026-01-15' },
        { amount: 600, payment_date: '2026-02-15' },
        { amount: 600, payment_date: '2026-03-15' },
      ],
      voidPeriods: [],
      workOrders: [
        { actual_cost: 120, paid_amount: 120, paid_date: '2026-02-01', room_id: 'room-1' },
      ],
      maintenanceRequests: [],
      agreements: [baseAgreement],
    });

    expect(result.grossIncome).toBe(1800);
    expect(result.voidDays).toBe(0);
    expect(result.voidLoss).toBe(0);
    expect(result.maintenanceCosts).toBe(120);
    expect(result.contribution).toBe(1680);
    expect(result.occupancyRate).toBe(1);
  });

  it('no rent in period → contribution equals -maintenanceCosts', () => {
    const result = computeRoomPnL({
      roomId: 'room-1',
      period: 'current_month',
      now: NOW,
      rentPayments: [{ amount: 600, payment_date: '2024-01-01' }], // outside window
      voidPeriods: [],
      workOrders: [{ actual_cost: 80, paid_amount: 80, paid_date: '2026-04-15', room_id: 'room-1' }],
      maintenanceRequests: [],
      agreements: [baseAgreement],
    });
    expect(result.grossIncome).toBe(0);
    expect(result.maintenanceCosts).toBe(80);
    expect(result.contribution).toBe(-80);
  });

  it('only allocates room-tagged maintenance (other-room costs ignored)', () => {
    const result = computeRoomPnL({
      roomId: 'room-1',
      period: 'last_12_months',
      now: NOW,
      rentPayments: [{ amount: 600, payment_date: '2026-03-01' }],
      voidPeriods: [],
      workOrders: [
        { actual_cost: 100, paid_amount: 100, paid_date: '2026-03-10', room_id: 'room-1' },
        { actual_cost: 999, paid_amount: 999, paid_date: '2026-03-10', room_id: 'room-2' },
      ],
      maintenanceRequests: [
        { actual_cost: 50, room_v2_id: 'room-1', cost_approved_at: '2026-03-12' },
        { actual_cost: 9999, room_v2_id: 'room-9', cost_approved_at: '2026-03-12' },
      ],
      agreements: [baseAgreement],
    });
    expect(result.maintenanceCosts).toBe(150);
    expect(result.contribution).toBe(450);
  });

  it('mid-tenancy void produces void days × daily rent loss', () => {
    // 10 days void, rent 600 pcm → daily 20, voidLoss 200
    const result = computeRoomPnL({
      roomId: 'room-1',
      period: 'last_12_months',
      now: NOW,
      rentPayments: [{ amount: 600, payment_date: '2026-03-01' }],
      voidPeriods: [
        { start_date: '2026-04-01', end_date: '2026-04-10', room_id: 'room-1' },
      ],
      workOrders: [],
      maintenanceRequests: [],
      agreements: [baseAgreement],
    });
    expect(result.voidDays).toBe(10);
    expect(result.voidLoss).toBe(200);
    // contribution = 600 - 200 - 0 = 400
    expect(result.contribution).toBe(400);
    // occupancy = (365 - 10) / 365
    expect(result.occupancyRate).toBeCloseTo((365 - 10) / 365, 5);
  });

  it('period boundary inclusivity: payments on the edge are included', () => {
    const { start, end } = resolvePeriodRange('current_month', NOW);
    expect(start).not.toBeNull();
    const startStr = start!.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const result = computeRoomPnL({
      roomId: 'room-1',
      period: 'current_month',
      now: NOW,
      rentPayments: [
        { amount: 100, payment_date: startStr },
        { amount: 100, payment_date: endStr },
        { amount: 100, payment_date: '1999-01-01' },
      ],
      voidPeriods: [],
      workOrders: [],
      maintenanceRequests: [],
      agreements: [baseAgreement],
    });
    expect(result.grossIncome).toBe(200);
  });

  it('overlapDays clips void periods to the requested window', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-31');
    // void Dec 25 → Jan 5 → overlap = Jan 1..Jan 5 = 5 days inclusive
    expect(overlapDays('2025-12-25', '2026-01-05', start, end)).toBe(5);
    // ongoing void from Jan 20 → end of window inclusive = 12 days
    expect(overlapDays('2026-01-20', null, start, end)).toBe(12);
    // entirely outside
    expect(overlapDays('2025-01-01', '2025-02-01', start, end)).toBe(0);
  });
});
