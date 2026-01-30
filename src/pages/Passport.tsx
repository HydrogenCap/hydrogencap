import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, 
  Building2, 
  Search, 
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Home,
  Flame,
  Droplets,
  Zap,
  Key,
  Shield,
  Upload,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePassportsWithProperties, calculatePassportCompleteness } from '@/hooks/usePropertyPassport';

export default function Passport() {
  const { data: propertiesWithPassports, isLoading } = usePassportsWithProperties();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter properties based on search
  const filteredProperties = propertiesWithPassports?.filter(p => 
    p.address_line?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.postcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.area_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Calculate stats
  const totalProperties = propertiesWithPassports?.length || 0;
  const withPassport = propertiesWithPassports?.filter(p => p.passport)?.length || 0;
  const completePassports = propertiesWithPassports?.filter(p => {
    const completeness = calculatePassportCompleteness(p.passport);
    return completeness.complete;
  })?.length || 0;

  const averageCompleteness = propertiesWithPassports?.length 
    ? Math.round(
        propertiesWithPassports.reduce((acc, p) => {
          return acc + calculatePassportCompleteness(p.passport).percentage;
        }, 0) / propertiesWithPassports.length
      )
    : 0;

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
              Stock condition and operational data for all properties
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
                  <p className="text-sm text-muted-foreground">With Passport Data</p>
                  <p className="text-2xl font-bold">{withPassport}</p>
                </div>
                <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Complete Passports</p>
                  <p className="text-2xl font-bold text-success">{completePassports}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Completeness</p>
                  <p className="text-2xl font-bold">{averageCompleteness}%</p>
                </div>
                <Progress value={averageCompleteness} className="w-16 h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address or postcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Properties Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>All Properties</CardTitle>
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
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Property</TableHead>
                      <TableHead>Completeness</TableHead>
                      <TableHead>Property Type</TableHead>
                      <TableHead>Utilities</TableHead>
                      <TableHead>Security</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProperties.map((property) => {
                      const completeness = calculatePassportCompleteness(property.passport);
                      const passport = property.passport;
                      
                      return (
                        <TableRow key={property.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{property.address_line}</p>
                              <p className="text-sm text-muted-foreground">
                                {property.postcode}
                                {property.area_name && ` • ${property.area_name}`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={completeness.percentage} 
                                className="w-20 h-2"
                              />
                              <span className="text-sm text-muted-foreground">
                                {completeness.percentage}%
                              </span>
                              {completeness.complete && (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {passport?.asset_agreement_category ? (
                              <Badge variant="outline">
                                <Home className="h-3 w-3 mr-1" />
                                {passport.asset_agreement_category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {passport?.gas_meter_location && (
                                <Badge variant="secondary" className="text-xs">
                                  <Flame className="h-3 w-3 mr-1" />
                                  Gas
                                </Badge>
                              )}
                              {passport?.electric_meter_location && (
                                <Badge variant="secondary" className="text-xs">
                                  <Zap className="h-3 w-3 mr-1" />
                                  Elec
                                </Badge>
                              )}
                              {passport?.water_meter_location && (
                                <Badge variant="secondary" className="text-xs">
                                  <Droplets className="h-3 w-3 mr-1" />
                                  Water
                                </Badge>
                              )}
                              {!passport?.gas_meter_location && !passport?.electric_meter_location && !passport?.water_meter_location && (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {passport?.keysafe_code && (
                                <Badge variant="secondary" className="text-xs">
                                  <Key className="h-3 w-3 mr-1" />
                                  Keysafe
                                </Badge>
                              )}
                              {passport?.hmo_licence_required && (
                                <Badge variant="secondary" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  HMO
                                </Badge>
                              )}
                              {!passport?.keysafe_code && !passport?.hmo_licence_required && (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button asChild variant="ghost" size="icon">
                              <Link to={`/properties/${property.id}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
