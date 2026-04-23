import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Bath, ChefHat, DoorOpen, Users, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SEVERITY } from '@/lib/design-tokens';
import { useHMOCompliance } from '@/hooks/useHMOCompliance';
import { HMO_ROOM_MINIMUMS, HMO_AMENITY_RATIOS } from '@/lib/hmo-compliance';
import type { RoomComplianceResult } from '@/lib/hmo-compliance';

interface Props {
  propertyId: string;
  propertyType: string;
}

export function HMOCompliancePanel({ propertyId, propertyType }: Props) {
  const { data: result, isLoading, isHMO } = useHMOCompliance(propertyId, propertyType);

  if (!isHMO) return null;
  if (isLoading) return <Skeleton className="h-64" />;
  if (!result) return null;

  const { roomResults, amenityResults, overallCompliant, issues, licenceConditions, totalOccupants } = result;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <CardTitle>HMO Room Compliance</CardTitle>
        </div>
        <OverallStatusBadge compliant={overallCompliant} />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Occupant Summary */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{totalOccupants} total occupant{totalOccupants !== 1 ? 's' : ''} across {roomResults.length} bedroom{roomResults.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Room Size Compliance Table */}
        {roomResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Bedroom Size Compliance</h4>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <Info className="h-3 w-3" />
              Min: Single {HMO_ROOM_MINIMUMS.single_adult} m² · Double {HMO_ROOM_MINIMUMS.double_adult} m² · Child {HMO_ROOM_MINIMUMS.child_under_10} m²
            </div>
            <div className="space-y-2">
              {roomResults.map(room => (
                <RoomComplianceRow key={room.roomId} room={room} />
              ))}
            </div>
          </div>
        )}

        {roomResults.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No bedrooms recorded. Add rooms with size and occupancy data to check compliance.
          </p>
        )}

        <Separator />

        {/* Amenity Ratios */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Amenity Ratios</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AmenityCard
              icon={<Bath className="h-4 w-4" />}
              label="Bathrooms"
              actual={amenityResults.bathroomsActual}
              required={amenityResults.bathroomsRequired}
              compliant={amenityResults.bathroomCompliant}
              ratio={`1 per ${HMO_AMENITY_RATIOS.bathroom_per_occupants}`}
            />
            <AmenityCard
              icon={<ChefHat className="h-4 w-4" />}
              label="Kitchens"
              actual={amenityResults.kitchensActual}
              required={amenityResults.kitchensRequired}
              compliant={amenityResults.kitchenCompliant}
              ratio={`1 per ${HMO_AMENITY_RATIOS.kitchen_per_occupants}`}
            />
            <AmenityCard
              icon={<DoorOpen className="h-4 w-4" />}
              label="Toilets"
              actual={amenityResults.toiletsActual}
              required={amenityResults.toiletsRequired}
              compliant={amenityResults.toiletCompliant}
              ratio={`1 per ${HMO_AMENITY_RATIOS.toilet_per_occupants}`}
            />
          </div>
        </div>

        {/* Issues List */}
        {issues.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Issues ({issues.length})
              </h4>
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="text-sm text-red-700 dark:text-red-400 pl-5 relative before:content-['•'] before:absolute before:left-1 before:text-red-500">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <Separator />

        {/* Licence Conditions Checklist */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">HMO Licence Conditions</h4>
          <ul className="space-y-1.5">
            {licenceConditions.map((condition, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/50 shrink-0" />
                {condition}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function OverallStatusBadge({ compliant }: { compliant: boolean }) {
  if (compliant) {
    return (
      <Badge className={SEVERITY.success.badge}>
        <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
      </Badge>
    );
  }
  return (
    <Badge className={SEVERITY.critical.badge}>
      <XCircle className="h-3 w-3 mr-1" /> Non-Compliant
    </Badge>
  );
}

function RoomComplianceRow({ room }: { room: RoomComplianceResult }) {
  const pct = room.minimumRequired > 0
    ? Math.min(100, (room.sizeSqm / room.minimumRequired) * 100)
    : 0;

  const occupancyLabel = room.occupancy === 'single' ? 'Single' : room.occupancy === 'double' ? 'Double' : 'Child';

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-5 shrink-0">
        {room.isCompliant ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
      </div>
      <div className="min-w-[120px] font-medium truncate">{room.roomName}</div>
      <Badge variant="outline" className="text-xs shrink-0">{occupancyLabel}</Badge>
      <div className="flex-1 flex items-center gap-2">
        <Progress
          value={pct}
          className={`h-2 flex-1 ${room.isCompliant ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}`}
        />
        <span className="text-xs tabular-nums whitespace-nowrap w-[100px] text-right">
          {room.sizeSqm > 0 ? `${room.sizeSqm.toFixed(1)}` : '?'} / {room.minimumRequired} m²
        </span>
      </div>
      {!room.isCompliant && room.shortfall > 0 && room.sizeSqm > 0 && (
        <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
          −{room.shortfall.toFixed(2)} m²
        </span>
      )}
    </div>
  );
}

function AmenityCard({
  icon,
  label,
  actual,
  required,
  compliant,
  ratio,
}: {
  icon: React.ReactNode;
  label: string;
  actual: number;
  required: number;
  compliant: boolean;
  ratio: string;
}) {
  const severity = compliant ? SEVERITY.success : SEVERITY.critical;
  return (
    <div className={`rounded-lg border p-3 ${severity.border} ${severity.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {compliant ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        )}
      </div>
      <div className="text-lg font-bold tabular-nums">
        {actual} <span className="text-sm font-normal text-muted-foreground">/ {required} required</span>
      </div>
      <p className="text-xs text-muted-foreground">{ratio} occupants</p>
    </div>
  );
}
