import React from 'react';
import { MapPin, CheckCircle2, AlertTriangle, Clock, Navigation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackfillButton } from '@/components/geocoding/BackfillButton';
import { useProperties } from '@/hooks/useProperties';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function LocationSettingsTab() {
  const { data: properties, isLoading } = useProperties();

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!properties) return { total: 0, geocoded: 0, pending: 0, failed: 0, partial: 0 };
    
    const total = properties.length;
    const geocoded = properties.filter(p => p.geocode_status === 'SUCCESS').length;
    const partial = properties.filter(p => p.geocode_status === 'PARTIAL').length;
    const failed = properties.filter(p => p.geocode_status === 'FAILED').length;
    const pending = properties.filter(p => 
      !p.geocode_status || 
      p.geocode_status === 'NOT_STARTED' || 
      (!p.latitude && p.geocode_status !== 'FAILED')
    ).length;
    
    return { total, geocoded, pending, failed, partial };
  }, [properties]);

  // Get properties with issues
  const problemProperties = React.useMemo(() => {
    if (!properties) return [];
    return properties.filter(p => 
      p.geocode_status === 'FAILED' || 
      p.geocode_status === 'PARTIAL' ||
      (!p.latitude && p.geocode_status !== 'SUCCESS')
    ).slice(0, 20);
  }, [properties]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Navigation className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{stats.geocoded}</p>
                <p className="text-sm text-muted-foreground">Geocoded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backfill Card */}
      <BackfillButton missingCount={stats.pending + stats.failed} />

      {/* Problem Properties Table */}
      {problemProperties.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Properties Needing Attention
            </CardTitle>
            <CardDescription>
              Properties with geocoding issues that may need manual review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Postcode</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problemProperties.map((property) => (
                    <TableRow key={property.id}>
                      <TableCell>
                        {property.geocode_status === 'FAILED' ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                          </Badge>
                        ) : property.geocode_status === 'PARTIAL' ? (
                          <Badge variant="secondary" className="gap-1 bg-warning/10 text-warning border-warning/20">
                            <Clock className="h-3 w-3" />
                            Partial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {property.address_line}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {property.postcode || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                        {property.geocode_error || '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/properties/${property.id}/edit`}>
                            Edit
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {properties && properties.filter(p => 
              p.geocode_status === 'FAILED' || 
              p.geocode_status === 'PARTIAL' ||
              (!p.latitude && p.geocode_status !== 'SUCCESS')
            ).length > 20 && (
              <p className="text-center text-sm text-muted-foreground py-3">
                Showing first 20 properties
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success state */}
      {stats.total > 0 && stats.geocoded === stats.total && (
        <Card className="bg-success/5 border-success/20">
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
              <h3 className="text-lg font-semibold text-success">All Properties Geocoded</h3>
              <p className="text-sm text-muted-foreground">
                All {stats.total} properties have valid map coordinates
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
