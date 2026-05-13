# Product Excellence Roadmap

TenureIQ should be the operating system for property portfolios owned through one or more entities. The product should answer five questions faster than a spreadsheet, folder structure, or accountant email chain can:

1. What do I own?
2. Who owns it?
3. What is it worth?
4. What is owed, due, or at risk?
5. What should I do next?

## Product Principles

- Property and entity data must be connected everywhere. A user should never need to mentally join a property, SPV, loan, shareholder, document, tenancy, and compliance record.
- Every KPI should be explainable. Portfolio numbers should drill down to the properties, entities, loans, rents, and ownership percentages behind them.
- The app should be action-led. Dashboards should surface the next decision or task, not just display charts.
- Missing data should be treated as a workflow. If a valuation, loan balance, ownership percentage, filing date, rent, or certificate is missing, the app should show what is missing and where to fix it.
- Entity management should be financially useful as well as legally complete.

## Near-Term Quality Bar

### Portfolio Command Centre

- Add portfolio value, debt, equity, LTV, rent, NOI, cashflow, DSCR, and net yield.
- Let users switch between gross portfolio and attributable ownership views.
- Add filters for entity, lifecycle stage, property type, region, lender, and risk status.
- Make every KPI clickable with a clear calculation breakdown.

### Entity Operating View

- Add entity-level value, debt, equity, rent, cashflow, LTV, and filing status.
- Show properties, loans, bank accounts, intercompany loans, shareholders, filings, documents, and accounting exports from one entity page.
- Add entity health status: missing company number, overdue accounts, overdue confirmation statement, unresolved Companies House mismatch, missing ownership data, missing accounting data.

### Property Passport

- Expand each property passport into a live operating record covering ownership, valuation, debt, rent roll, compliance, insurance, documents, CapEx, works, inspections, and timeline.
- Include room-level income for HMOs and room-let properties in all property-level yield and rent calculations.
- Make passport PDF export match the live page calculations.

### Ownership Graph

- Extend the ownership chart to include properties and loans beneath each entity.
- Support effective dates for shareholders, share transfers, entity ownership, and property ownership changes.
- Show direct ownership and beneficial ownership side by side.

### Documents

- Ensure every document can be linked to an entity, property, tenant, loan, investor/shareholder, compliance item, tax period, or accounting period.
- Replace remaining company-centric wording with entity-centric wording where the underlying model supports SPVs, personal ownership, trusts, and joint ventures.
- Add missing-document alerts for key entity and property workflows.

## Implementation Notes

- Compliance status on property cards should come from `compliance_matrix_v2`, not placeholder logic.
- Property detail rent and yield should use `property_room_summary_v2` for room-let properties.
- Entity property summaries should include valuation and rent so entity pages become useful management views.
- Compliance mutations should invalidate property compliance status queries when certificates or requirements change.
- Entity dashboards should reuse portfolio KPI logic where possible to avoid inconsistent calculations.

## Definition Of Best-In-Class

The app is best-in-class when a portfolio owner can open it each morning and know:

- Which properties or entities need attention today.
- Which deadlines are upcoming or overdue.
- Which assets are underperforming.
- Which entities have filing, tax, debt, or cashflow issues.
- Which documents are missing or expiring.
- Which refinancing, rent, acquisition, or disposal decisions are worth acting on.

The product should feel less like a database and more like a calm, accurate control room for property ownership.
