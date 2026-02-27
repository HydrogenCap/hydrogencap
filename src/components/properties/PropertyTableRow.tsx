import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Edit2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import type { PropertyPassport } from '@/hooks/usePropertyPassport';
import { getPropertyMetrics, calculatePropertyRisk, type PropertyMetrics } from '@/lib/propertyMetrics';
import { formatGBPDecimal, formatPercent, formatDateUK } from '@/lib/calculations';
import {
  ExpiryBadge,
  LTVBadge,
  EPCBadge,
  RiskBadge,
  OwnershipDisplay,
  CashflowValue,
  MeterDisplay,
} from '@/components/properties/PropertiesTableCells';
import type { ColumnKey } from '@/lib/propertiesTableConfig';

interface PropertyTableRowProps {
  property: PropertyWithFinancials;
  visibleColumns: Set<ColumnKey>;
  photoMap?: Map<string, string>;
  companyMap?: Map<string, string>;
  passport?: PropertyPassport;
  onRowClick: (propertyId: string, e: React.MouseEvent) => void;
}

export function PropertyTableRow({
  property,
  visibleColumns,
  photoMap,
  companyMap,
  passport,
  onRowClick,
}: PropertyTableRowProps) {
  const metrics = getPropertyMetrics(property);
  const coverPhoto = photoMap?.get(property.id);
  const risk = calculatePropertyRisk(property, passport, metrics);

  return (
    <TableRow
      className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={(e) => onRowClick(property.id, e)}
    >
      {visibleColumns.has('photo') && (
        <TableCell className="w-16 p-2">
          {coverPhoto ? (
            <img src={coverPhoto} alt="" className="w-12 h-12 object-cover rounded-md" />
          ) : (
            <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </TableCell>
      )}
      {visibleColumns.has('address') && (
        <TableCell className="font-medium max-w-[200px]">
          <span className="truncate block">{property.address_line}</span>
          {property.postcode && (
            <span className="text-xs text-muted-foreground">{property.postcode}</span>
          )}
        </TableCell>
      )}
      {visibleColumns.has('area') && (
        <TableCell className="text-muted-foreground">{property.area_name || '—'}</TableCell>
      )}
      {visibleColumns.has('ownership') && (
        <TableCell className="max-w-[180px] truncate">
          <OwnershipDisplay property={property} companyMap={companyMap} />
        </TableCell>
      )}
      {visibleColumns.has('propertyType') && (
        <TableCell className="text-muted-foreground">{property.property_type || '—'}</TableCell>
      )}
      {visibleColumns.has('beds') && (
        <TableCell className="text-center">{property.beds ?? '—'}</TableCell>
      )}
      {visibleColumns.has('value') && (
        <TableCell className="text-right font-medium">{formatGBPDecimal(metrics.currentValue)}</TableCell>
      )}
      {visibleColumns.has('purchasePrice') && (
        <TableCell className="text-right text-muted-foreground">{formatGBPDecimal(metrics.purchasePrice)}</TableCell>
      )}
      {visibleColumns.has('purchaseDate') && (
        <TableCell className="text-muted-foreground">{formatDateUK(property.original_purchase_date)}</TableCell>
      )}
      {visibleColumns.has('lender') && (
        <TableCell className="text-muted-foreground">{metrics.loan?.lender || '—'}</TableCell>
      )}
      {visibleColumns.has('interestRate') && (
        <TableCell className="text-right">
          {metrics.loan?.interest_rate_percent ? `${Number(metrics.loan.interest_rate_percent).toFixed(2)}%` : '—'}
        </TableCell>
      )}
      {visibleColumns.has('fixedOrVariable') && (
        <TableCell className="text-muted-foreground capitalize">{metrics.loan?.fixed_or_variable || '—'}</TableCell>
      )}
      {visibleColumns.has('mortgageType') && (
        <TableCell className="text-muted-foreground">{metrics.loan?.mortgage_type || '—'}</TableCell>
      )}
      {visibleColumns.has('capitalOrInterest') && (
        <TableCell className="text-muted-foreground capitalize">
          {metrics.loan?.capital_or_interest === 'interest' ? 'Interest-only' :
           metrics.loan?.capital_or_interest === 'repayment' ? 'Repayment' : '—'}
        </TableCell>
      )}
      {visibleColumns.has('fixedRateExpires') && (
        <TableCell><ExpiryBadge date={metrics.loan?.fixed_rate_expires} /></TableCell>
      )}
      {visibleColumns.has('insuranceExpire') && (
        <TableCell><ExpiryBadge date={null} /></TableCell>
      )}
      {visibleColumns.has('mortgageBalance') && (
        <TableCell className="text-right text-muted-foreground">{formatGBPDecimal(metrics.mortgageBalance)}</TableCell>
      )}
      {visibleColumns.has('mortgagePayment') && (
        <TableCell className="text-right">
          {metrics.mortgagePayment !== null ? formatGBPDecimal(metrics.mortgagePayment) : '—'}
        </TableCell>
      )}
      {visibleColumns.has('rentalIncome') && (
        <TableCell className="text-right">{formatGBPDecimal(metrics.annualRent)}</TableCell>
      )}
      {visibleColumns.has('billsManagement') && (
        <TableCell className="text-right text-muted-foreground">{formatGBPDecimal(metrics.billsManagement)}</TableCell>
      )}
      {visibleColumns.has('netRent') && (
        <TableCell className="text-right"><CashflowValue value={metrics.netRent} /></TableCell>
      )}
      {visibleColumns.has('yield') && (
        <TableCell className="text-right">
          {metrics.yieldPercent !== null ? (
            <span className={metrics.yieldPercent >= 0 ? 'text-success' : 'text-destructive'}>
              {formatPercent(metrics.yieldPercent)}
            </span>
          ) : '—'}
        </TableCell>
      )}
      {visibleColumns.has('ltv') && (
        <TableCell className="text-right"><LTVBadge ltv={metrics.ltv} /></TableCell>
      )}
      {visibleColumns.has('equity') && (
        <TableCell className="text-right font-medium text-primary">{formatGBPDecimal(metrics.equity)}</TableCell>
      )}
      {visibleColumns.has('epc') && (
        <TableCell><EPCBadge rating={property.epc_rating} required={property.epc_required} /></TableCell>
      )}
      {visibleColumns.has('monthlyCashflow') && (
        <TableCell className="text-right"><CashflowValue value={metrics.monthlyCashflow} /></TableCell>
      )}
      {visibleColumns.has('riskStatus') && (
        <TableCell><RiskBadge level={risk.level} issues={risk.issues} /></TableCell>
      )}
      {visibleColumns.has('keysafeCode') && (
        <TableCell className={passport?.keysafe_code ? '' : 'text-destructive'}>
          {passport?.keysafe_code || 'Missing'}
        </TableCell>
      )}
      {visibleColumns.has('waterStopTap') && (
        <TableCell className={passport?.water_stop_tap_location ? 'text-muted-foreground' : 'text-warning'}>
          {passport?.water_stop_tap_location || 'Missing'}
        </TableCell>
      )}
      {visibleColumns.has('electricMeter') && (
        <TableCell className="text-muted-foreground text-xs max-w-[120px]">
          <MeterDisplay location={passport?.electric_meter_location} number={passport?.electric_meter_number} />
        </TableCell>
      )}
      {visibleColumns.has('gasMeter') && (
        <TableCell className="text-muted-foreground text-xs max-w-[120px]">
          <MeterDisplay location={passport?.gas_meter_location} number={passport?.gas_meter_number} />
        </TableCell>
      )}
      {visibleColumns.has('waterMeter') && (
        <TableCell className="text-muted-foreground text-xs max-w-[120px]">
          <MeterDisplay location={passport?.water_meter_location} number={passport?.water_meter_number} />
        </TableCell>
      )}
      {visibleColumns.has('constructionDateBand') && (
        <TableCell className="text-muted-foreground">
          {passport?.construction_date_band || passport?.built_in_year || '—'}
        </TableCell>
      )}
      {visibleColumns.has('hmoLicenceNumber') && (
        <TableCell className="text-muted-foreground">{passport?.hmo_licence_number || '—'}</TableCell>
      )}
      {visibleColumns.has('hmoLicenceExpiry') && (
        <TableCell><ExpiryBadge date={passport?.hmo_licence_expiry} /></TableCell>
      )}
      {visibleColumns.has('managementCompany') && (
        <TableCell className="text-muted-foreground max-w-[150px] truncate">
          {passport?.property_management_company || '—'}
        </TableCell>
      )}
      {visibleColumns.has('actions') && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to={`/properties/${property.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to={`/properties/${property.id}/edit`}>
                <Edit2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
