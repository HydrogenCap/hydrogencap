import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Database, ArrowRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { PropertyWithFinancials } from '@/hooks/useProperties';

interface DataQualityWidgetProps {
  properties: PropertyWithFinancials[];
}

interface FieldCompleteness {
  label: string;
  field: string;
  filled: number;
  total: number;
  percentage: number;
  priority: 'high' | 'medium' | 'low';
}

export function DataQualityWidget({ properties }: DataQualityWidgetProps) {
  const fieldStats = useMemo<FieldCompleteness[]>(() => {
    if (!properties?.length) return [];

    const total = properties.length;

    // Calculate completeness for each key field
    const fields: FieldCompleteness[] = [
      {
        label: 'EPC Rating',
        field: 'epc_rating',
        filled: properties.filter(p => p.epc_rating).length,
        total,
        percentage: 0,
        priority: 'high',
      },
      {
        label: 'Purchase Price',
        field: 'purchase_price_gbp',
        filled: properties.filter(p => p.purchase_price_gbp).length,
        total,
        percentage: 0,
        priority: 'high',
      },
      {
        label: 'Current Value',
        field: 'current_value_gbp',
        filled: properties.filter(p => p.current_value_gbp).length,
        total,
        percentage: 0,
        priority: 'high',
      },
      {
        label: 'Tenure',
        field: 'tenure',
        filled: properties.filter(p => p.tenure).length,
        total,
        percentage: 0,
        priority: 'medium',
      },
      {
        label: 'Purchase Date',
        field: 'original_purchase_date',
        filled: properties.filter(p => p.original_purchase_date).length,
        total,
        percentage: 0,
        priority: 'medium',
      },
      {
        label: 'Property Type',
        field: 'property_type',
        filled: properties.filter(p => p.property_type).length,
        total,
        percentage: 0,
        priority: 'medium',
      },
      {
        label: 'Bedrooms',
        field: 'beds',
        filled: properties.filter(p => p.beds !== null && p.beds !== undefined).length,
        total,
        percentage: 0,
        priority: 'low',
      },
      {
        label: 'Mortgage Details',
        field: 'loans',
        filled: properties.filter(p => p.loans?.length && p.loans[0]?.current_mortgage_balance_gbp).length,
        total,
        percentage: 0,
        priority: 'high',
      },
      {
        label: 'Rental Income',
        field: 'income',
        filled: properties.filter(p => p.income?.length && p.income[0]?.annual_rent_gbp).length,
        total,
        percentage: 0,
        priority: 'high',
      },
      {
        label: 'Coordinates',
        field: 'latitude',
        filled: properties.filter(p => p.latitude && p.longitude).length,
        total,
        percentage: 0,
        priority: 'low',
      },
    ];

    // Calculate percentages
    fields.forEach(f => {
      f.percentage = f.total > 0 ? Math.round((f.filled / f.total) * 100) : 0;
    });

    return fields;
  }, [properties]);

  // Calculate overall completeness
  const overallCompleteness = useMemo(() => {
    if (!fieldStats.length) return 0;
    const sum = fieldStats.reduce((acc, f) => acc + f.percentage, 0);
    return Math.round(sum / fieldStats.length);
  }, [fieldStats]);

  // Get status color
  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-success';
    if (percentage >= 70) return 'text-amber-500';
    return 'text-destructive';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-success';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 90) return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (percentage >= 70) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  // Filter to show only incomplete fields, sorted by priority and then percentage
  const incompleteFields = fieldStats
    .filter(f => f.percentage < 100)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.percentage - b.percentage;
    })
    .slice(0, 5);

  const completeFieldsCount = fieldStats.filter(f => f.percentage === 100).length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Data Quality
        </CardTitle>
        <div className={`text-2xl font-bold ${getStatusColor(overallCompleteness)}`}>
          {overallCompleteness}%
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Completeness</span>
            <span className="font-medium">{completeFieldsCount}/{fieldStats.length} fields complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor(overallCompleteness)}`}
              style={{ width: `${overallCompleteness}%` }}
            />
          </div>
        </div>

        {/* Incomplete Fields */}
        {incompleteFields.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Needs Attention</h4>
            {incompleteFields.map(field => (
              <div key={field.field} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(field.percentage)}
                    <span className="text-sm font-medium">{field.label}</span>
                    {field.priority === 'high' && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-destructive/50 text-destructive">
                        Priority
                      </Badge>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(field.percentage)}`}>
                    {field.filled}/{field.total}
                  </span>
                </div>
                <Progress 
                  value={field.percentage} 
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
            <p className="text-sm text-success font-medium">All data complete!</p>
          </div>
        )}

        {/* Link to Properties */}
        <Link 
          to="/properties"
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors mt-4"
        >
          <span className="text-sm font-medium">View all properties</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
