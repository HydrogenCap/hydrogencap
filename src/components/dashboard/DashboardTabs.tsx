import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { ThisMonthWidget } from '@/components/dashboard/ThisMonthWidget';
import { ActionsRequiredWidget } from '@/components/dashboard/ActionsRequiredWidget';
import { DashboardCalendarWidget } from '@/components/dashboard/DashboardCalendarWidget';
import { RentCollectionWidget } from '@/components/dashboard/RentCollectionWidget';
import { OccupancyWidget } from '@/components/dashboard/OccupancyWidget';
import { VoidCostWidget } from '@/components/dashboard/VoidCostWidget';
import { TenancyPipelineWidget } from '@/components/dashboard/TenancyPipelineWidget';
import { MaintenanceWidget } from '@/components/dashboard/MaintenanceWidget';
import { ComplianceTasksWidget } from '@/components/dashboard/ComplianceTasksWidget';
import { TenancyEventsWidget } from '@/components/dashboard/TenancyEventsWidget';
import { WorkOrdersWidget } from '@/components/dashboard/WorkOrdersWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { PortfolioHealthWidget } from '@/components/dashboard/PortfolioHealthWidget';
import { MissingComplianceWidget } from '@/components/dashboard/MissingComplianceWidget';
import { CHFilingAlertsWidget } from '@/components/dashboard/CHFilingAlertsWidget';
import { DataQualityWidget } from '@/components/dashboard/DataQualityWidget';
import { StockConditionSection } from '@/components/dashboard/StockConditionSection';
import { LenderExposureChart } from '@/components/dashboard/LenderExposureChart';
import { AreaExposureChart } from '@/components/dashboard/AreaExposureChart';
import { BeneficialOwnerWidget } from '@/components/dashboard/BeneficialOwnerWidget';
import { UpcomingExpirationsWidget } from '@/components/dashboard/UpcomingExpirationsWidget';
import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';

const PropertyMap = lazy(() => import('@/components/maps/PropertyMap').then(m => ({ default: m.PropertyMap })));

interface MapProperty {
  id: string;
  address_line: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  lifecycle_type: string;
  town_city: string;
}

interface DashboardTabsProps {
  /** V1 bridge properties for widgets that still need V1 shape */
  v1CoreRentalProperties: PropertyWithFinancials[];
  v1Properties: PropertyWithFinancials[] | undefined;
  /** Lender exposure data */
  lenderData: ReturnType<typeof import('@/components/dashboard/LenderExposureChart').computeLenderData>;
  /** Properties adapted for the map */
  mapProperties: MapProperty[];
  onHealthMetricClick: () => void;
}

export function DashboardTabs({
  v1CoreRentalProperties,
  v1Properties,
  lenderData,
  mapProperties,
  onHealthMetricClick,
}: DashboardTabsProps) {
  const navigate = useNavigate();
  const hasPropertiesWithCoords = mapProperties.length > 0;

  return (
    <Tabs defaultValue="this-month" className="w-full">
      <TabsList className="w-full max-w-xl grid grid-cols-5 overflow-x-auto flex-nowrap">
        <TabsTrigger value="this-month">This Month</TabsTrigger>
        <TabsTrigger value="health">Health</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
        <TabsTrigger value="finance">Finance</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      {/* THIS MONTH TAB (default) */}
      <TabsContent value="this-month" className="space-y-6 mt-4">
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <ErrorBoundary><ThisMonthWidget /></ErrorBoundary>
          <ErrorBoundary><ActionsRequiredWidget /></ErrorBoundary>
          <ErrorBoundary><DashboardCalendarWidget /></ErrorBoundary>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
          <ErrorBoundary><RentCollectionWidget /></ErrorBoundary>
          <ErrorBoundary><OccupancyWidget /></ErrorBoundary>
          <ErrorBoundary><VoidCostWidget /></ErrorBoundary>
          <ErrorBoundary><TenancyPipelineWidget /></ErrorBoundary>
        </div>
        <ErrorBoundary><MaintenanceWidget /></ErrorBoundary>
        <ErrorBoundary><ComplianceTasksWidget /></ErrorBoundary>
        <ErrorBoundary><TenancyEventsWidget /></ErrorBoundary>
        <ErrorBoundary><WorkOrdersWidget /></ErrorBoundary>
      </TabsContent>

      {/* HEALTH TAB */}
      <TabsContent value="health" className="space-y-6 mt-4">
        {v1CoreRentalProperties.length > 0 && (
          <ErrorBoundary>
            <PortfolioHealthWidget
              properties={v1CoreRentalProperties}
              onClick={onHealthMetricClick}
            />
          </ErrorBoundary>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <ErrorBoundary><MissingComplianceWidget /></ErrorBoundary>
          <ErrorBoundary><CHFilingAlertsWidget /></ErrorBoundary>
        </div>
        <ErrorBoundary><DashboardCalendarWidget /></ErrorBoundary>
        <ErrorBoundary>
          {v1Properties && v1Properties.length > 0 && (
            <DataQualityWidget properties={v1Properties} />
          )}
        </ErrorBoundary>
        <ErrorBoundary><StockConditionSection /></ErrorBoundary>
      </TabsContent>

      {/* MAP TAB */}
      <TabsContent value="map" className="space-y-6 mt-4">
        <SectionCard
          title="Property Map"
          subtitle={`${mapProperties.length} properties plotted`}
          icon={MapPin}
          onClick={() => navigate('/dashboard/map')}
          showArrow
          noPadding
          contentClassName="p-0"
        >
          {hasPropertiesWithCoords ? (
            <div className="p-4">
              <Suspense fallback={<Skeleton className="h-[400px] rounded-lg" />}>
                <PropertyMap
                  properties={mapProperties as unknown as import('@/hooks/useProperties').PropertyWithFinancials[]}
                  className="h-[400px] rounded-lg"
                />
              </Suspense>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Add properties with coordinates to see them on the map</p>
              </div>
            </div>
          )}
        </SectionCard>
      </TabsContent>

      {/* FINANCE TAB */}
      <TabsContent value="finance" className="space-y-6 mt-4">
        <div className="grid gap-6 md:grid-cols-2">
          <LenderExposureChart lenderData={lenderData} />
          <ErrorBoundary>
            {v1Properties && <AreaExposureChart properties={v1Properties} />}
          </ErrorBoundary>
        </div>
        <ErrorBoundary>
          <BeneficialOwnerWidget />
        </ErrorBoundary>
      </TabsContent>

      {/* ACTIVITY TAB */}
      <TabsContent value="activity" className="space-y-6 mt-4">
        <ErrorBoundary><RecentActivityWidget /></ErrorBoundary>
        <ErrorBoundary><UpcomingExpirationsWidget /></ErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}
