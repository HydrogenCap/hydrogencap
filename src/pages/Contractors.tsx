import React, { useState, useDeferredValue } from 'react';
import { Plus, Search, Star, Filter, Wrench, MapPin } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common';
import { ListState } from '@/components/ListState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContractors, useUpdateContractor, type Contractor } from '@/hooks/useContractors';

// Legacy optional fields some contractor records may still have
type ContractorWithLegacyFields = Contractor & {
  coverage_areas?: string[] | null;
  avg_rating?: number | null;
};
import { COMPLIANCE_TYPES } from '@/lib/schemas/compliance';
import {
  AddContractorDialog,
  ContractorDetailDrawer,
  ContractorProfileCard,
  RateContractorDialog,
} from '@/components/contractors';
import { JobTrackerWidget } from '@/components/contractors/JobTrackerWidget';

const RATING_FILTERS = [
  { value: 'all', label: 'Any Rating' },
  { value: '4', label: '4+ Stars' },
  { value: '3', label: '3+ Stars' },
  { value: '2', label: '2+ Stars' },
];

export default function Contractors() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [complianceFilter, setComplianceFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [ratingJobData, setRatingJobData] = useState<{ contractorId: string; contractorName: string; jobId: string } | null>(null);

  const { data: contractors, isLoading, error, refetch } = useContractors({
    isActive: true,
    complianceType: complianceFilter !== 'all' ? complianceFilter : undefined,
  });

  const updateContractor = useUpdateContractor();

  // Collect unique coverage areas for the area filter
  const allAreas = Array.from(
    new Set(
      contractors?.flatMap((c) => (c as ContractorWithLegacyFields).coverage_areas || c.service_areas || []) || []
    )
  ).sort();

  // Apply filters
  const filteredContractors = contractors?.filter((c) => {
    // Search
    if (deferredSearch) {
      const search = deferredSearch.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(search);
      const companyMatch = c.company_name?.toLowerCase().includes(search);
      if (!nameMatch && !companyMatch) return false;
    }

    // Rating filter
    if (ratingFilter !== 'all') {
      const minRating = parseFloat(ratingFilter);
      const rating = (c as ContractorWithLegacyFields).avg_rating ?? c.average_rating ?? 0;
      if (rating < minRating) return false;
    }

    // Area filter
    if (areaFilter !== 'all') {
      const areas = (c as ContractorWithLegacyFields).coverage_areas || c.service_areas || [];
      if (!areas.includes(areaFilter)) return false;
    }

    return true;
  });

  const preferredContractors = filteredContractors?.filter((c) => c.is_preferred) || [];
  const otherContractors = filteredContractors?.filter((c) => !c.is_preferred) || [];

  const handleTogglePreferred = (contractorId: string, preferred: boolean) => {
    updateContractor.mutate({ id: contractorId, is_preferred: preferred });
  };

  const activeFilters = [complianceFilter, ratingFilter, areaFilter].filter((f) => f !== 'all').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contractor Directory</h1>
            <p className="text-muted-foreground">Manage your trusted contractors and service providers</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contractor
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contractors..."
                  aria-label="Search contractors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trade / Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trades</SelectItem>
                  {COMPLIANCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-36">
                  <Star className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  {RATING_FILTERS.map((rf) => (
                    <SelectItem key={rf.value} value={rf.value}>{rf.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {allAreas.length > 0 && (
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="w-44">
                    <MapPin className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {allAreas.map((area) => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setComplianceFilter('all');
                    setRatingFilter('all');
                    setAreaFilter('all');
                  }}
                >
                  Clear filters ({activeFilters})
                </Button>
              )}
            </div>

            {/* Contractors Grid */}
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="h-64 animate-pulse bg-muted" />
                ))}
              </div>
            ) : (
              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">All ({filteredContractors?.length || 0})</TabsTrigger>
                  <TabsTrigger value="preferred">
                    <Star className="h-4 w-4 mr-1 fill-amber-400 text-amber-400" />
                    Preferred ({preferredContractors.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  {preferredContractors.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        Preferred Contractors
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {preferredContractors.map((contractor) => (
                          <ContractorProfileCard
                            key={contractor.id}
                            contractor={contractor as ContractorWithLegacyFields}
                            onClick={() => setSelectedContractorId(contractor.id)}
                            onTogglePreferred={handleTogglePreferred}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {otherContractors.length > 0 && (
                    <div>
                      {preferredContractors.length > 0 && (
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Other Contractors</h3>
                      )}
                      <div className="grid gap-4 md:grid-cols-2">
                        {otherContractors.map((contractor) => (
                          <ContractorProfileCard
                            key={contractor.id}
                            contractor={contractor as ContractorWithLegacyFields}
                            onClick={() => setSelectedContractorId(contractor.id)}
                            onTogglePreferred={handleTogglePreferred}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredContractors?.length === 0 && (
                    searchTerm || complianceFilter !== 'all' || ratingFilter !== 'all' || areaFilter !== 'all' ? (
                      <EmptyState
                        icon={Search}
                        title="No contractors found"
                        description="Try adjusting your search or filter criteria."
                      />
                    ) : (
                      <EmptyState
                        icon={Wrench}
                        title="No contractors added"
                        description="Add your contractors and tradespeople to assign maintenance jobs."
                        action={{ label: 'Add Contractor', onClick: () => setShowAddDialog(true) }}
                      />
                    )
                  )}
                </TabsContent>

                <TabsContent value="preferred" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {preferredContractors.map((contractor) => (
                      <ContractorProfileCard
                        key={contractor.id}
                        contractor={contractor as ContractorWithLegacyFields}
                        onClick={() => setSelectedContractorId(contractor.id)}
                        onTogglePreferred={handleTogglePreferred}
                      />
                    ))}
                  </div>
                  {preferredContractors.length === 0 && (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                        <h3 className="font-medium mb-1">No preferred contractors</h3>
                        <p className="text-sm text-muted-foreground">
                          Mark contractors as preferred to see them here
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Sidebar - Active Jobs */}
          <div>
            <JobTrackerWidget />
          </div>
        </div>
      </div>

      <AddContractorDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />

      <ContractorDetailDrawer
        contractorId={selectedContractorId}
        open={!!selectedContractorId}
        onOpenChange={(open) => !open && setSelectedContractorId(null)}
      />

      <RateContractorDialog
        contractorId={ratingJobData?.contractorId ?? null}
        contractorName={ratingJobData?.contractorName}
        jobId={ratingJobData?.jobId ?? null}
        open={!!ratingJobData}
        onOpenChange={(open) => !open && setRatingJobData(null)}
      />
    </AppLayout>
  );
}
