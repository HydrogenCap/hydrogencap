import { Upload, FileSpreadsheet } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Import() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Data</h1>
          <p className="text-muted-foreground">Import properties from a CSV file</p>
        </div>

        {/* Import Card */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              CSV Import
            </CardTitle>
            <CardDescription>
              Upload a CSV file exported from Google Sheets or Excel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Drag and drop your CSV file here, or click to browse
              </p>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Select CSV File
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-card border-border max-w-2xl">
          <CardHeader>
            <CardTitle>CSV Format Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your CSV should include the following columns:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><span className="text-foreground font-medium">address_line</span> - Full property address</li>
              <li><span className="text-foreground font-medium">area_name</span> - Location/area (e.g., Oxfordshire)</li>
              <li><span className="text-foreground font-medium">postcode</span> - UK postcode</li>
              <li><span className="text-foreground font-medium">property_type</span> - Type of property</li>
              <li><span className="text-foreground font-medium">beds</span> - Number of bedrooms</li>
              <li><span className="text-foreground font-medium">current_value_gbp</span> - Current value in GBP</li>
              <li><span className="text-foreground font-medium">mortgage_balance_gbp</span> - Outstanding mortgage</li>
              <li><span className="text-foreground font-medium">annual_rent_gbp</span> - Annual rental income</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
