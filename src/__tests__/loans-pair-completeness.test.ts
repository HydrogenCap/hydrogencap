/**
 * loans-pair-completeness.test.ts
 *
 * Why this exists
 * ---------------
 * Per docs/release/loans-reconciliation-plan-2026-05-02.md §2/§7.A, every
 * V1 `loans.id` must resolve to exactly one V2 `loan_facilities.id` via the
 * address bridge:
 *
 *   loans → properties → properties_v2 (lower(trim(address)) match) → loan_facilities
 *
 * Prompt #43 closed the final drift (25 Arle Gardens). This test guards against
 * regression: if a future address edit re-introduces drift, the snapshot in
 * fixtures/loans-pair-snapshot.json will need to be re-generated AND the
 * underlying drift must be fixed before the snapshot is updated.
 *
 * Refreshing the snapshot
 * -----------------------
 * After any V1 properties.address_line normalisation (rare — V1 is frozen),
 * re-run the following against the live DB and replace the `pairs` array in
 * fixtures/loans-pair-snapshot.json:
 *
 *   SELECT l.id AS v1_loan_id,
 *          lf.id AS v2_loan_facility_id,
 *          lower(trim(p.address_line)) AS address
 *   FROM loans l
 *   JOIN properties p           ON p.id = l.property_id
 *   JOIN properties_v2 p2       ON lower(trim(p2.address_line_1)) = lower(trim(p.address_line))
 *   JOIN loan_facilities lf     ON lf.property_id = p2.id
 *   ORDER BY l.id;
 *
 * If the row count from that query drops below the count of `loans`, DO NOT
 * update the snapshot — fix the drift first (see §7.A in the reconciliation plan).
 */
import { describe, it, expect } from "vitest";
import snapshot from "./fixtures/loans-pair-snapshot.json";

interface Pair {
  v1_loan_id: string;
  v2_loan_facility_id: string;
  address: string;
}

describe("V1 loans ↔ V2 loan_facilities pair completeness", () => {
  const pairs = snapshot.pairs as Pair[];

  it("snapshot covers all 24 V1 loans (no unpaired ids)", () => {
    // Locked to the count at the time of Prompt #43. If V1 loans grows, the
    // V1 freeze guard would have already blocked it — investigate before
    // updating this number.
    expect(pairs.length).toBe(24);
  });

  it("every V1 loan id is unique (1:1 not 1:many)", () => {
    const v1Ids = pairs.map(p => p.v1_loan_id);
    const dupes = v1Ids.filter((id, i) => v1Ids.indexOf(id) !== i);
    expect(dupes, `Duplicate V1 loan ids in bridge: ${dupes.join(", ")}`).toEqual([]);
  });

  it("every V2 loan_facility id is unique (1:1 not many:1)", () => {
    const v2Ids = pairs.map(p => p.v2_loan_facility_id);
    const dupes = v2Ids.filter((id, i) => v2Ids.indexOf(id) !== i);
    expect(dupes, `Duplicate V2 loan_facility ids in bridge: ${dupes.join(", ")}`).toEqual([]);
  });

  it("no pair has an empty address (bridge never matched on '')", () => {
    const empty = pairs.filter(p => !p.address || !p.address.trim());
    expect(empty.map(p => p.v1_loan_id)).toEqual([]);
  });

  it("includes the 25 Arle Gardens row that Prompt #43 reconciled", () => {
    const arle = pairs.find(p => p.v1_loan_id === "4fef3020-8985-4310-b249-e5af8dfbe096");
    expect(arle, "25 Arle Gardens V1 loan id missing from snapshot — drift returned, see plan §7.A").toBeDefined();
    expect(arle?.v2_loan_facility_id).toBe("596fa758-64f3-49b7-b6de-8813eb05e775");
    expect(arle?.address).toBe("25 arle gardens");
  });
});
