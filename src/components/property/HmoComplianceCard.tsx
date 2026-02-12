import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Home } from 'lucide-react';
import { useRooms, type Room } from '@/hooks/useRooms';

// Housing Act 2004 minimum room sizes (m²)
const MIN_SIZES = {
  single_adult: 6.51,   // 1 person over 10
  double_adult: 10.22,  // 2 persons over 10
  child_under_10: 4.64, // 1 person under 10
};

// Convert sq ft to sq metres
function sqftToSqm(sqft: number): number {
  return sqft * 0.092903;
}

function getRoomMinSize(roomType: string): number {
  if (roomType === 'double' || roomType === 'ensuite' || roomType === 'studio') {
    return MIN_SIZES.double_adult;
  }
  return MIN_SIZES.single_adult;
}

interface HmoComplianceCardProps {
  propertyId: string;
  isHmo?: boolean;
  beds?: number | null;
  bathrooms?: number | null;
}

export function HmoComplianceCard({ propertyId, isHmo, beds, bathrooms }: HmoComplianceCardProps) {
  const { data: rooms, isLoading } = useRooms(propertyId);

  if (!isHmo) return null;

  const roomsWithSize = rooms?.filter(r => r.square_footage) || [];
  const totalRooms = rooms?.length || 0;

  // Room size compliance
  const sizeChecks = roomsWithSize.map(room => {
    const sqm = sqftToSqm(room.square_footage!);
    const minSize = getRoomMinSize(room.room_type);
    return {
      room,
      sqm: Math.round(sqm * 100) / 100,
      minSize,
      compliant: sqm >= minSize,
    };
  });

  const sizeCompliantCount = sizeChecks.filter(c => c.compliant).length;
  const sizeFailCount = sizeChecks.filter(c => !c.compliant).length;
  const roomsWithoutSize = totalRooms - roomsWithSize.length;

  // Amenity ratios (rough UK guidelines)
  const occupants = beds || totalRooms;
  const bathroomRatio = bathrooms && occupants ? occupants / bathrooms : null;
  const bathroomCompliant = bathroomRatio !== null && bathroomRatio <= 5; // Max 5 persons per bathroom

  // Overall score
  const checks = [
    sizeFailCount === 0 && roomsWithoutSize === 0,
    bathroomCompliant,
    totalRooms > 0,
  ];
  const passedChecks = checks.filter(Boolean).length;
  const totalChecks = checks.length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            HMO Compliance
          </span>
          <Badge 
            variant={score === 100 ? 'default' : score >= 66 ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {score}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={score} className="h-2" />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rooms...</p>
        ) : (
          <div className="space-y-3">
            {/* Room size compliance */}
            <div>
              <h4 className="text-sm font-medium mb-2">Room Sizes (Housing Act 2004)</h4>
              {totalRooms === 0 ? (
                <p className="text-xs text-muted-foreground">No rooms registered. Add rooms to check compliance.</p>
              ) : (
                <div className="space-y-1.5">
                  {sizeChecks.map(check => (
                    <div key={check.room.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {check.room.room_name} ({check.room.room_type})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={check.compliant ? 'text-foreground' : 'text-destructive font-medium'}>
                          {check.sqm}m² / {check.minSize}m² min
                        </span>
                        {check.compliant ? (
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </div>
                    </div>
                  ))}
                  {roomsWithoutSize > 0 && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {roomsWithoutSize} room{roomsWithoutSize > 1 ? 's' : ''} missing size data
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Amenity ratios */}
            <div>
              <h4 className="text-sm font-medium mb-2">Amenity Ratios</h4>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Bathroom ratio</span>
                  <div className="flex items-center gap-2">
                    <span className={bathroomCompliant === false ? 'text-destructive font-medium' : ''}>
                      {bathroomRatio ? `${bathroomRatio.toFixed(1)} occupants/bathroom` : '—'}
                    </span>
                    {bathroomCompliant !== null && (
                      bathroomCompliant ? (
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      )
                    )}
                  </div>
                </div>
                {bathroomCompliant === false && (
                  <p className="text-xs text-destructive">
                    Exceeds recommended ratio of 1 bathroom per 5 occupants
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
