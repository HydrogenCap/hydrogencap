import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, 
  Building2, 
  Search, 
  ChevronRight,
  Home,
  Upload,
  Filter,
  X,
  Landmark,
  Dna,
  Edit3,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useProperties } from '@/hooks/useProperties';
import { PROPERTY_TYPES, LISTED_STATUSES } from '@/hooks/useCoreIdentity';
import { PassportRowEditor } from '@/components/passport/PassportRowEditor';

export default function Passport() {
  const { data: properties, isLoading } = useProperties();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Filters
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('');
  const [listedStatusFilter, setListedStatusFilter] = useState<string>('');
  const [conservationAreaFilter, setConservationAreaFilter] = useState<string>('');

  const activeFilterCount = [propertyTypeFilter, listedStatusFilter, conservationAreaFilter].filter(Boolean).length;

  // Filter properties based on search and filters
  const filteredProperties = properties?.filter(p => {
    // Text search - address, postcode, uprn
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      p.address_line?.toLowerCase().includes(searchLower) ||
      p.postcode?.toLowerCase().includes(searchLower) ||
      p.area_name?.toLowerCase().includes(searchLower) ||
      p.uprn?.toLowerCase().includes(searchLower) ||
      p.title_number?.toLowerCase().includes(searchLower);

    // Filters
    const matchesPropertyType = !propertyTypeFilter || p.property_type === propertyTypeFilter;
    const matchesListedStatus = !listedStatusFilter || p.listed_status === listedStatusFilter;
    const matchesConservation = !conservationAreaFilter || 
      (conservationAreaFilter === 'yes' && p.conservation_area === true) ||
      (conservationAreaFilter === 'no' && (p.conservation_area === false || p.conservation_area === null));

    return matchesSearch && matchesPropertyType && matchesListedStatus && matchesConservation;
  }) || [];

  // Calculate stats
  const totalProperties = properties?.length || 0;
  const withCoreIdentity = properties?.filter(p => 
    p.property_type && p.construction_type && p.listed_status
  )?.length || 0;
  
  const conservationCount = properties?.filter(p => p.conservation_area === true)?.length || 0;
  const listedCount = properties?.filter(p => p.listed_status && p.listed_status !== 'Not listed')?.length || 0;

  const clearFilters = () => {
    setPropertyTypeFilter('');
    setListedStatusFilter('');
    setConservationAreaFilter('');
  };

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Property Passports
            </h1>
            <p className="text-muted-foreground">
              Core property identity and operational data — click Edit to update inline
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/import/passport">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Properties</p>
                  <p className="text-2xl font-bold">{totalProperties}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Core Identity Complete</p>
                  <p className="text-2xl font-bold">{withCoreIdentity}</p>
                </div>
                <Dna className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conservation Areas</p>
                  <p className="text-2xl font-bold text-warning">{conservationCount}</p>
                </div>
                <Landmark className="h-8 w-8 text-warning/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Listed Buildings</p>
                  <p className="text-2xl font-bold text-primary">{listedCount}</p>
                </div>
                <Home className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address, postcode, UPRN, title number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs">
                      Clear all
                    </Button>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Property Type</label>
                    <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        {PROPERTY_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Listed Status</label>
                    <Select value={listedStatusFilter} onValueChange={setListedStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        {LISTED_STATUSES.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Conservation Area</label>
                    <Select value={conservationAreaFilter} onValueChange={setConservationAreaFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active filters display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {propertyTypeFilter && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Type: {propertyTypeFilter}
                <button onClick={() => setPropertyTypeFilter('')} className="ml-1 rounded-full hover:bg-muted">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {listedStatusFilter && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Listed: {listedStatusFilter}
                <button onClick={() => setListedStatusFilter('')} className="ml-1 rounded-full hover:bg-muted">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {conservationAreaFilter && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Conservation: {conservationAreaFilter === 'yes' ? 'Yes' : 'No'}
                <button onClick={() => setConservationAreaFilter('')} className="ml-1 rounded-full hover:bg-muted">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Properties Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              All Properties ({filteredProperties.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No properties found</p>
                {activeFilterCount > 0 && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProperties.map((property) => (
                  <div key={property.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/30">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                        {/* Address */}
                        <div className="md:col-span-2">
                          {property.property_name && (
                            <p className="font-medium text-primary text-sm">{property.property_name}</p>
                          )}
                          <p className="font-medium text-foreground">{property.address_line}</p>
                          <p className="text-sm text-muted-foreground">
                            {property.postcode}
                            {property.town_city && ` • ${property.town_city}`}
                          </p>
                        </div>

                        {/* Type */}
                        <div>
                          {property.property_type ? (
                            <Badge variant="outline">
                              <Home className="h-3 w-3 mr-1" />
                              {property.property_type}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-dashed text-muted-foreground">
                              No type
                            </Badge>
                          )}
                        </div>

                        {/* Construction */}
                        <div>
                          {property.construction_type ? (
                            <span className="text-sm">{property.construction_type}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>

                        {/* Listed & Conservation */}
                        <div className="flex flex-wrap gap-1">
                          {property.listed_status && property.listed_status !== 'Not listed' && (
                            <Badge variant="secondary" className="text-xs">
                              {property.listed_status}
                            </Badge>
                          )}
                          {property.conservation_area && (
                            <Badge variant="outline" className="text-xs border-warning text-warning">
                              <Landmark className="h-3 w-3 mr-1" />
                              Conservation
                            </Badge>
                          )}
                          {!property.listed_status && !property.conservation_area && (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 justify-end">
                          <PassportRowEditor
                            property={property}
                            isExpanded={expandedRowId === property.id}
                            onToggle={() => toggleRow(property.id)}
                          />
                          <Button asChild variant="ghost" size="icon">
                            <Link to={`/properties/${property.id}?tab=operations`}>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Editor */}
                    {expandedRowId === property.id && (
                      <div className="px-4 pb-4">
                        <PassportRowEditor
                          property={property}
                          isExpanded={true}
                          onToggle={() => toggleRow(property.id)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
