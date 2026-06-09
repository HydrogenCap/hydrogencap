/**
 * Lender-grade Mortgage Broker Pack PDF generator.
 *
 * Composes a multi-page lender-ready document from the section builders in
 * `./sections.ts`, all of which share state via `LenderPackContext`.
 */
import {
  LenderPackContext,
  type MortgageBrokerPackData,
} from './context';
import {
  buildCoverPage,
  buildExecutiveSummary,
  buildPropertySummary,
  buildValuationFinanceSnapshot,
  buildRentalIncomeAffordability,
  buildHmoComplianceLicensing,
  buildBorrowerEntityProfile,
  buildBorrowerTrackRecord,
  buildInsuranceSummary,
  buildExitStrategyRiskNote,
  buildDocumentChecklist,
  buildBrokerNotes,
} from './sections';

export class LenderGradeMortgageBrokerPack {
  private ctx: LenderPackContext;

  constructor(data: MortgageBrokerPackData) {
    this.ctx = new LenderPackContext(data);
  }

  generate(): this {
    const { ctx } = this;
    buildCoverPage(ctx);
    ctx.doc.addPage();
    buildExecutiveSummary(ctx);
    ctx.doc.addPage();
    buildPropertySummary(ctx);
    buildValuationFinanceSnapshot(ctx);
    ctx.doc.addPage();
    buildRentalIncomeAffordability(ctx);
    buildHmoComplianceLicensing(ctx);
    ctx.doc.addPage();
    buildBorrowerEntityProfile(ctx);
    buildBorrowerTrackRecord(ctx);
    ctx.doc.addPage();
    buildInsuranceSummary(ctx);
    buildExitStrategyRiskNote(ctx);
    ctx.doc.addPage();
    buildDocumentChecklist(ctx);

    if (ctx.data.brokerNotes) {
      buildBrokerNotes(ctx);
    }

    return this;
  }

  public getBlob(): Blob {
    this.ctx.addFooters();
    return this.ctx.doc.output('blob');
  }

  public download(filename: string) {
    this.ctx.addFooters();
    this.ctx.doc.save(filename);
  }
}
