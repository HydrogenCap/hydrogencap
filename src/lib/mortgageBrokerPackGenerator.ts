/**
 * Backwards-compatible barrel for the lender-grade Mortgage Broker Pack.
 *
 * The implementation now lives in `src/lib/pdf/lenderPack/`:
 *   - `context.ts`     — shared `LenderPackContext` (state + primitives) and data types
 *   - `sections.ts`    — one builder function per pack section
 *   - `LenderGradeMortgageBrokerPack.ts` — composer that wires sections together
 */
export type {
  CompanyData,
  PortfolioSummary,
  MortgageBrokerPackData,
  PackValidation,
} from './pdf/lenderPack/context';
export { validateMortgageBrokerPack } from './pdf/lenderPack/context';
export { LenderGradeMortgageBrokerPack } from './pdf/lenderPack/LenderGradeMortgageBrokerPack';
