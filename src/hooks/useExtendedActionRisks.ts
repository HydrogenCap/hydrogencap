/**
 * Today / Actions page extended risk list.
 *
 * Augments `usePortfolioRisks()` with:
 *  - Red-status entities (from `useEntityHealthMap`) — one RiskItem per entity-level issue.
 *  - High / critical arrears risks (from `arrears_predictions`) — one per tenancy.
 *
 * Returns `RiskItem`-shaped rows so the existing Actions UI just works.
 */
import { useMemo } from 'react';
import { usePortfolioRisks, type RiskItem } from './usePortfolioRisks';
import { useEntityHealthMap } from './useEntityHealthMap';
import { useArrearsPredictions } from './useArrearsPredictions';
import { useDashboardTenanciesV2, useDashboardPropertiesV2 } from './useDashboardDataV2';

export function useExtendedActionRisks() {
  const base = usePortfolioRisks();
  const { map: healthMap, isLoading: healthLoading } = useEntityHealthMap();
  const { data: predictions, isLoading: predLoading } = useArrearsPredictions();
  const { data: tenancies } = useDashboardTenanciesV2();
  const { data: properties } = useDashboardPropertiesV2();

  const tenantById = useMemo(() => {
    const m = new Map<string, { name: string; propertyId: string | null }>();
    (tenancies || []).forEach(t => {
      const tenant = (t as { tenant?: { id?: string; first_name?: string | null; last_name?: string | null } }).tenant;
      if (tenant?.id) {
        const name = `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Tenant';
        m.set(tenant.id, { name, propertyId: (t as { property_id?: string }).property_id ?? null });
      }
    });
    return m;
  }, [tenancies]);

  const propertyById = useMemo(() => {
    const m = new Map<string, string>();
    (properties || []).forEach(p => {
      const addr = (p as { address_line?: string | null; address_line_1?: string | null }).address_line
        ?? (p as { address_line_1?: string | null }).address_line_1
        ?? 'Property';
      m.set(p.id, addr);
    });
    return m;
  }, [properties]);

  const extraRisks = useMemo<RiskItem[]>(() => {
    const out: RiskItem[] = [];

    // ─── Entity health (red only on the action list)
    for (const record of healthMap.values()) {
      if (record.level !== 'red') continue;
      for (const issue of record.issues) {
        if (issue.severity !== 'red') continue;
        out.push({
          id: `entity:${record.entityId}:${issue.id}`,
          propertyId: `entity:${record.entityId}`,
          address: record.entityName,
          type: 'entity_health',
          severity: 'critical',
          message: `${issue.label} — ${issue.detail}`,
          targetUrl: issue.fixUrl,
          priority: 120,
        });
      }
    }

    // ─── Arrears predictions (high + critical)
    for (const p of (predictions || [])) {
      if (p.risk_level !== 'high' && p.risk_level !== 'critical') continue;
      const tenant = p.tenant_id ? tenantById.get(p.tenant_id) : undefined;
      const address = propertyById.get(p.property_id) || tenant?.name || 'Tenancy';
      const tenantLabel = tenant?.name || 'Tenant';
      const factors = (p.contributing_factors || [])
        .slice(0, 2)
        .map(f => f.factor)
        .filter(Boolean)
        .join(', ');
      const score = Math.round(p.risk_score * 100);
      const msg = factors
        ? `${tenantLabel} — ${score}% arrears risk · ${factors}`
        : `${tenantLabel} — ${score}% arrears risk`;
      out.push({
        id: `arrears:${p.id}`,
        propertyId: p.property_id,
        address,
        type: 'arrears_risk',
        severity: p.risk_level === 'critical' ? 'critical' : 'warning',
        message: msg,
        targetUrl: `/rent-collection`,
        priority: p.risk_level === 'critical' ? 140 : 110,
      });
    }

    return out;
  }, [healthMap, predictions, tenantById, propertyById]);

  const merged = useMemo(() => {
    const all = [...base.risks, ...extraRisks];
    all.sort((a, b) => b.priority - a.priority);
    return all;
  }, [base.risks, extraRisks]);

  return {
    ...base,
    risks: merged,
    totalCount: merged.length,
    criticalCount: merged.filter(r => r.severity === 'critical').length,
    warningCount: merged.filter(r => r.severity === 'warning').length,
    isLoading: base.isLoading || healthLoading || predLoading,
  };
}
